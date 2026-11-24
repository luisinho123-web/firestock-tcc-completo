-- Etapas do pedido controladas pela loja no web-empresa (depois de reservations_fulfillment.sql).
-- Rode no SQL Editor do Supabase (projeto grvhxufpbvgvgurjaavb). Pode rodar de novo sem problema.
--
--   Retirar no local: recebido -> separando o pedido -> pronto para retirar -> retirado
--   Delivery:         recebido -> separando os produtos -> a caminho      -> entregue
--
-- A coluna nova `stage` guarda a etapa enquanto o pedido está em aberto. O fim (retirado/entregue) continua sendo
-- status = 'picked_up', marcado por confirm_pickup, e é isso que os painéis contam como venda; nada muda nos painéis.
-- A loja avança com advance_reservation; só para frente, e pode pular etapas (ex.: confirmar a retirada direto).
-- O app do cliente lê `stage` e as datas de cada etapa para mostrar a situação.

alter table public.reservations
  add column if not exists stage text not null default 'received',
  add column if not exists preparing_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists out_for_delivery_at timestamptz;

alter table public.reservations drop constraint if exists reservations_stage_check;
alter table public.reservations add constraint reservations_stage_check check (
  stage in ('received', 'preparing', 'ready', 'out_for_delivery')
  and (stage <> 'ready' or fulfillment = 'pickup')
  and (stage <> 'out_for_delivery' or fulfillment = 'delivery')
);

create or replace function public.advance_reservation(p_reservation_id uuid, p_stage text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_res record;
  v_rank_from int;
  v_rank_to int;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta.' using errcode = 'P0001';
  end if;

  select r.id, r.status, r.fulfillment, r.stage
    into v_res
    from public.reservations r
    join public.partners p on p.id = r.partner_id
   where r.id = p_reservation_id and p.owner_id = v_uid
   for update of r;

  if not found then
    raise exception 'Nenhum pedido da sua empresa com esse código.' using errcode = 'P0001';
  end if;
  if v_res.status not in ('pending', 'confirmed') then
    raise exception 'Este pedido já foi concluído ou cancelado.' using errcode = 'P0001';
  end if;

  if p_stage not in ('preparing', 'ready', 'out_for_delivery')
     or (p_stage = 'ready' and v_res.fulfillment <> 'pickup')
     or (p_stage = 'out_for_delivery' and v_res.fulfillment <> 'delivery') then
    raise exception 'Etapa inválida para este pedido.' using errcode = 'P0001';
  end if;

  v_rank_from := case v_res.stage when 'received' then 0 when 'preparing' then 1 else 2 end;
  v_rank_to := case p_stage when 'preparing' then 1 else 2 end;
  if v_rank_to <= v_rank_from then
    raise exception 'O pedido já está nessa etapa ou em uma etapa seguinte.' using errcode = 'P0001';
  end if;

  update public.reservations
     set stage = p_stage,
         status = 'confirmed', -- a loja aceitou e está trabalhando no pedido
         preparing_at = coalesce(preparing_at, now()),
         ready_at = case when p_stage = 'ready' then now() else ready_at end,
         out_for_delivery_at = case when p_stage = 'out_for_delivery' then now() else out_for_delivery_at end
   where id = v_res.id;

  return p_stage;
end;
$$;

-- cancel_reservation: igual à de reservations_flow.sql, e agora o cliente não cancela um delivery que já saiu para entrega.
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
  select r.id, r.consumer_id, r.partner_id, r.status, r.pickup_deadline, r.stage
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

  if v_res.consumer_id = v_uid and not v_is_owner and not private.is_admin() then
    if v_res.stage = 'out_for_delivery' then
      raise exception 'O pedido já saiu para entrega e não pode mais ser cancelado.' using errcode = 'P0001';
    end if;
    if v_res.pickup_deadline is not null and now() > v_res.pickup_deadline - interval '1 hour' then
      raise exception 'O cancelamento só é possível até 1 hora antes do fim do prazo de retirada.' using errcode = 'P0001';
    end if;
  end if;

  update public.products pr
     set quantity = pr.quantity + ri.quantity
    from public.reservation_items ri
   where ri.reservation_id = v_res.id and pr.id = ri.product_id;

  update public.reservations set status = 'cancelled', cancelled_at = now() where id = v_res.id;
end;
$$;

revoke execute on function public.advance_reservation(uuid, text) from public, anon;
grant execute on function public.advance_reservation(uuid, text) to authenticated;
revoke execute on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;
