-- Fluxo de reservas: o app grava a compra no banco e a empresa confirma a retirada.
-- Rode no SQL Editor do Supabase (projeto grvhxufpbvgvgurjaavb). Pode rodar de novo sem problema (create or replace).
--
-- Antes desta migração, `reservations` e `reservation_items` só tinham regra de LEITURA (RLS), então nada era gravado
-- e os painéis da empresa e do administrador ficavam vazios. A escrita é feita só por estas três funções
-- (SECURITY DEFINER), nunca por INSERT/UPDATE direto do app. Assim o preço, o estoque e o dono são conferidos no banco
-- e o cliente não consegue inventar preço nem marcar a própria reserva como retirada.
--
--   create_reservation(partner_id, items)  -> app mobile, no "Confirmar pedido" (RF011: reserva e baixa o estoque)
--   cancel_reservation(reservation_id)     -> app mobile (cliente) ou web-empresa (dono); devolve o estoque (RF012)
--   confirm_pickup(reservation_id | code)  -> web-empresa: marca como retirada = VENDA nos painéis (RF013)

-- 1) Criar a reserva -----------------------------------------------------------------------------------------------
-- items: [{"product_id": "<uuid>", "quantity": 2}, ...] — todos da mesma empresa.
create or replace function public.create_reservation(p_partner_id uuid, p_items jsonb)
returns table (reservation_id uuid, pickup_code text, total_cents integer, pickup_deadline timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_item record;
  v_product record;
  v_total integer := 0;
  v_code text;
  v_reservation_id uuid;
  v_deadline timestamptz := now() + interval '4 hours'; -- RN005: retirada em até 4 horas
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para reservar.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.partners p where p.id = p_partner_id and p.status = 'approved') then
    raise exception 'Este estabelecimento não está disponível no momento.' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido está vazio.' using errcode = 'P0001';
  end if;

  -- Código de retirada: 6 dígitos, único entre as reservas.
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.reservations r where r.pickup_code = v_code);
  end loop;

  insert into public.reservations (consumer_id, partner_id, pickup_code, status, total_cents, pickup_deadline)
  values (v_uid, p_partner_id, v_code, 'pending', 0, v_deadline)
  returning id into v_reservation_id;

  -- Soma linhas repetidas do mesmo produto e trava os produtos em ordem fixa (evita deadlock entre duas compras).
  for v_item in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::int)::int as quantity
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Quantidade inválida no pedido.' using errcode = 'P0001';
    end if;

    select pr.id, pr.name, pr.partner_id, pr.status, pr.expires_at, pr.quantity, pr.price_cents
      into v_product
      from public.products pr
     where pr.id = v_item.product_id
     for update;

    if not found or v_product.partner_id <> p_partner_id then
      raise exception 'Um dos produtos não pertence a este estabelecimento.' using errcode = 'P0001';
    end if;
    if v_product.status <> 'active' or v_product.expires_at <= now() then
      raise exception '"%" não está mais disponível.', v_product.name using errcode = 'P0001';
    end if;
    if v_product.quantity < v_item.quantity then
      if v_product.quantity = 0 then
        raise exception '"%" esgotou.', v_product.name using errcode = 'P0001';
      end if;
      raise exception 'Só restam % unidade(s) de "%".', v_product.quantity, v_product.name using errcode = 'P0001';
    end if;

    update public.products set quantity = quantity - v_item.quantity where id = v_product.id;

    insert into public.reservation_items (reservation_id, product_id, quantity, unit_price_cents)
    values (v_reservation_id, v_product.id, v_item.quantity, v_product.price_cents);

    v_total := v_total + v_item.quantity * v_product.price_cents;
  end loop;

  update public.reservations set total_cents = v_total where id = v_reservation_id;

  return query select v_reservation_id, v_code, v_total, v_deadline;
end;
$$;

-- 2) Cancelar a reserva e devolver o estoque ------------------------------------------------------------------------
-- Cliente: até 1 hora antes do fim do prazo de retirada (RF012). Dono da empresa e admin: enquanto estiver em aberto.
create or replace function public.cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_res record;
  v_is_owner boolean;
begin
  select r.id, r.consumer_id, r.partner_id, r.status, r.pickup_deadline
    into v_res
    from public.reservations r
   where r.id = p_reservation_id
   for update;

  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'P0001';
  end if;

  v_is_owner := exists (select 1 from public.partners p where p.id = v_res.partner_id and p.owner_id = v_uid);

  if v_uid is null or not (v_res.consumer_id = v_uid or v_is_owner or private.is_admin()) then
    raise exception 'Reserva não encontrada.' using errcode = 'P0001';
  end if;

  if v_res.status not in ('pending', 'confirmed') then
    raise exception 'Esta reserva não pode mais ser cancelada.' using errcode = 'P0001';
  end if;

  if v_res.consumer_id = v_uid and not v_is_owner and not private.is_admin()
     and v_res.pickup_deadline is not null and now() > v_res.pickup_deadline - interval '1 hour' then
    raise exception 'O cancelamento só é possível até 1 hora antes do fim do prazo de retirada.' using errcode = 'P0001';
  end if;

  update public.products pr
     set quantity = pr.quantity + ri.quantity
    from public.reservation_items ri
   where ri.reservation_id = v_res.id and pr.id = ri.product_id;

  update public.reservations set status = 'cancelled', cancelled_at = now() where id = v_res.id;
end;
$$;

-- 3) Confirmar a retirada (a venda) ---------------------------------------------------------------------------------
-- Pelo id (botão na lista) ou pelo código de 6 dígitos que o cliente mostra. Só o dono da empresa.
create or replace function public.confirm_pickup(p_reservation_id uuid default null, p_code text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := nullif(regexp_replace(coalesce(p_code, ''), '\D', '', 'g'), '');
  v_res record;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta.' using errcode = 'P0001';
  end if;
  if p_reservation_id is null and v_code is null then
    raise exception 'Informe o código de retirada.' using errcode = 'P0001';
  end if;

  select r.id, r.status
    into v_res
    from public.reservations r
    join public.partners p on p.id = r.partner_id
   where p.owner_id = v_uid
     and (r.id = p_reservation_id or (p_reservation_id is null and r.pickup_code = v_code))
   for update of r;

  if not found then
    raise exception 'Nenhuma reserva da sua empresa com esse código.' using errcode = 'P0001';
  end if;

  if v_res.status = 'picked_up' then
    raise exception 'Esta reserva já foi retirada.' using errcode = 'P0001';
  end if;
  if v_res.status not in ('pending', 'confirmed') then
    raise exception 'Esta reserva foi cancelada ou expirou.' using errcode = 'P0001';
  end if;

  update public.reservations set status = 'picked_up', picked_up_at = now() where id = v_res.id;
  return v_res.id;
end;
$$;

revoke execute on function public.create_reservation(uuid, jsonb) from public, anon;
revoke execute on function public.cancel_reservation(uuid) from public, anon;
revoke execute on function public.confirm_pickup(uuid, text) from public, anon;
grant execute on function public.create_reservation(uuid, jsonb) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
grant execute on function public.confirm_pickup(uuid, text) to authenticated;
