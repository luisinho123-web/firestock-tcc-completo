-- Retirar no local OU delivery (depois de reservations_flow.sql).
-- Rode no SQL Editor do Supabase (projeto grvhxufpbvgvgurjaavb). Pode rodar de novo sem problema.
--
-- O cliente escolhe no checkout:
--   pickup   -> retira na loja em até 4 horas (RN005); pode pagar na retirada
--   delivery -> informa o endereço; a loja entrega
-- Nos dois casos a loja confirma no web-empresa (confirm_pickup): "retirado" ou "entregue". O status no banco fica
-- `picked_up` (= pedido concluído) e é isso que os painéis contam como VENDA. A receita continua sendo só os itens.
--
-- Colunas novas em reservations (as reservas que já existem viram 'pickup'):
--   fulfillment        'pickup' | 'delivery'
--   delivery_address   endereço do cliente (só delivery)
--   payment_method     'pix' | 'cartao' | 'dinheiro' ('dinheiro' = paga na loja ou na entrega)
--   delivery_fee_cents taxa de entrega informada pelo app (só para a loja saber quanto cobrar; não entra na receita)
--   discount_cents     desconto de cupom do app (idem)
--   amount_due_cents   total que o cliente paga = itens + taxa - desconto (calculado aqui)

alter table public.reservations
  add column if not exists fulfillment text not null default 'pickup',
  add column if not exists delivery_address text,
  add column if not exists payment_method text,
  add column if not exists delivery_fee_cents integer not null default 0,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists amount_due_cents integer;

alter table public.reservations drop constraint if exists reservations_fulfillment_check;
alter table public.reservations add constraint reservations_fulfillment_check check (fulfillment in ('pickup', 'delivery'));
alter table public.reservations drop constraint if exists reservations_payment_method_check;
alter table public.reservations add constraint reservations_payment_method_check
  check (payment_method is null or payment_method in ('pix', 'cartao', 'dinheiro'));
alter table public.reservations drop constraint if exists reservations_delivery_address_check;
alter table public.reservations add constraint reservations_delivery_address_check
  check (fulfillment = 'pickup' or length(btrim(coalesce(delivery_address, ''))) > 0);

update public.reservations set amount_due_cents = total_cents where amount_due_cents is null;

-- A versão antiga (2 parâmetros) sai, para não existirem duas funções com o mesmo nome.
drop function if exists public.create_reservation(uuid, jsonb);

create or replace function public.create_reservation(
  p_partner_id uuid,
  p_items jsonb,
  p_fulfillment text default 'pickup',
  p_delivery_address text default null,
  p_payment_method text default null,
  p_delivery_fee_cents integer default 0,
  p_discount_cents integer default 0
)
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
  v_fulfillment text := coalesce(p_fulfillment, 'pickup');
  v_address text := nullif(btrim(coalesce(p_delivery_address, '')), '');
  v_fee integer := coalesce(p_delivery_fee_cents, 0);
  v_discount integer := coalesce(p_discount_cents, 0);
  v_deadline timestamptz;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para reservar.' using errcode = 'P0001';
  end if;

  if v_fulfillment not in ('pickup', 'delivery') then
    raise exception 'Escolha retirar no local ou delivery.' using errcode = 'P0001';
  end if;
  if v_fulfillment = 'delivery' and v_address is null then
    raise exception 'Informe o endereço de entrega.' using errcode = 'P0001';
  end if;
  if p_payment_method is not null and p_payment_method not in ('pix', 'cartao', 'dinheiro') then
    raise exception 'Forma de pagamento inválida.' using errcode = 'P0001';
  end if;
  if v_fulfillment = 'pickup' then
    v_fee := 0;
    v_address := null;
    v_deadline := now() + interval '4 hours'; -- RN005: retirada em até 4 horas
  end if;
  if v_fee < 0 or v_fee > 10000 or v_discount < 0 then
    raise exception 'Valores do pedido inválidos.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.partners p where p.id = p_partner_id and p.status = 'approved') then
    raise exception 'Este estabelecimento não está disponível no momento.' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido está vazio.' using errcode = 'P0001';
  end if;

  -- Código de retirada/entrega: 6 dígitos, único entre as reservas.
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.reservations r where r.pickup_code = v_code);
  end loop;

  insert into public.reservations (
    consumer_id, partner_id, pickup_code, status, total_cents, pickup_deadline,
    fulfillment, delivery_address, payment_method, delivery_fee_cents, discount_cents
  )
  values (v_uid, p_partner_id, v_code, 'pending', 0, v_deadline, v_fulfillment, v_address, p_payment_method, v_fee, 0)
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

  -- O desconto nunca deixa o valor a pagar negativo.
  v_discount := least(v_discount, v_total + v_fee);

  update public.reservations
     set total_cents = v_total, discount_cents = v_discount, amount_due_cents = v_total + v_fee - v_discount
   where id = v_reservation_id;

  return query select v_reservation_id, v_code, v_total, v_deadline;
end;
$$;

-- confirm_pickup: igual à de reservations_flow.sql, com mensagens que servem para retirada e para entrega.
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
    raise exception 'Informe o código do pedido.' using errcode = 'P0001';
  end if;

  select r.id, r.status, r.fulfillment
    into v_res
    from public.reservations r
    join public.partners p on p.id = r.partner_id
   where p.owner_id = v_uid
     and (r.id = p_reservation_id or (p_reservation_id is null and r.pickup_code = v_code))
   for update of r;

  if not found then
    raise exception 'Nenhum pedido da sua empresa com esse código.' using errcode = 'P0001';
  end if;

  if v_res.status = 'picked_up' then
    if v_res.fulfillment = 'delivery' then
      raise exception 'Este pedido já foi entregue.' using errcode = 'P0001';
    end if;
    raise exception 'Este pedido já foi retirado.' using errcode = 'P0001';
  end if;
  if v_res.status not in ('pending', 'confirmed') then
    raise exception 'Este pedido foi cancelado ou expirou.' using errcode = 'P0001';
  end if;

  update public.reservations set status = 'picked_up', picked_up_at = now() where id = v_res.id;
  return v_res.id;
end;
$$;

revoke execute on function public.create_reservation(uuid, jsonb, text, text, text, integer, integer) from public, anon;
grant execute on function public.create_reservation(uuid, jsonb, text, text, text, integer, integer) to authenticated;
revoke execute on function public.confirm_pickup(uuid, text) from public, anon;
grant execute on function public.confirm_pickup(uuid, text) to authenticated;
