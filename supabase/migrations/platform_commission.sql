-- Comissão do FireStock sobre cada venda (depois de reservations_stages.sql).
-- Rode no SQL Editor do Supabase (projeto grvhxufpbvgvgurjaavb). Pode rodar de novo sem problema.
--
-- Regra:
--   * Comissão = % sobre o valor dos PRODUTOS vendidos (reservations.total_cents, já com o desconto de validade).
--     A taxa de entrega (é da loja, que entrega) e o cupom ficam de fora.
--   * Taxa padrão para todas as lojas (platform_settings, começa em 10%) e, se o admin quiser, uma taxa especial por
--     loja (partner_commissions). A taxa especial vence a padrão.
--   * A taxa é GRAVADA no pedido quando a loja confirma a retirada/entrega (confirm_pickup): mudar a taxa depois não
--     altera vendas antigas. reservations.commission_percent / commission_cents.
--   * Painel do admin: receita da plataforma = soma de commission_cents. Painel da empresa: bruto, comissão e líquido.
--   * Vendas concluídas antes desta migração recebem a taxa padrão (10%), para os painéis ficarem coerentes.
--   * Só o admin muda as taxas, pelas funções set_platform_commission e set_partner_commission (web-admin).

-- 1) Taxa padrão (tabela de uma linha só) ------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  commission_percent numeric(5, 2) not null default 10 check (commission_percent >= 0 and commission_percent <= 50),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_select on public.platform_settings;
create policy platform_settings_select on public.platform_settings for select to authenticated using (true);
-- Sem política de escrita: só set_platform_commission altera.

-- 2) Taxa especial por loja ------------------------------------------------------------------------------------
create table if not exists public.partner_commissions (
  partner_id uuid primary key references public.partners (id) on delete cascade,
  commission_percent numeric(5, 2) not null check (commission_percent >= 0 and commission_percent <= 50),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.partner_commissions enable row level security;
drop policy if exists partner_commissions_select on public.partner_commissions;
create policy partner_commissions_select on public.partner_commissions for select to authenticated
  using (
    exists (select 1 from public.partners p where p.id = partner_commissions.partner_id and p.owner_id = (select auth.uid()))
    or (select private.is_admin())
  );
-- Sem política de escrita: só set_partner_commission altera.

-- 3) Comissão gravada em cada pedido ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists commission_percent numeric(5, 2),
  add column if not exists commission_cents integer;

-- Vendas que já existiam: taxa padrão atual.
update public.reservations r
   set commission_percent = s.commission_percent,
       commission_cents = round(r.total_cents * s.commission_percent / 100)::int
  from public.platform_settings s
 where r.status = 'picked_up' and r.commission_cents is null;

-- 4) Taxa que vale hoje para uma loja ---------------------------------------------------------------------------
create or replace function private.commission_percent_for(p_partner_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pc.commission_percent from public.partner_commissions pc where pc.partner_id = p_partner_id),
    (select s.commission_percent from public.platform_settings s where s.id),
    10
  );
$$;
revoke execute on function private.commission_percent_for(uuid) from public, anon, authenticated;

-- 5) confirm_pickup: igual à de reservations_fulfillment.sql, e agora grava a comissão ----------------------------
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
  v_percent numeric;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta.' using errcode = 'P0001';
  end if;
  if p_reservation_id is null and v_code is null then
    raise exception 'Informe o código do pedido.' using errcode = 'P0001';
  end if;

  select r.id, r.status, r.fulfillment, r.partner_id, r.total_cents
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

  v_percent := private.commission_percent_for(v_res.partner_id);

  update public.reservations
     set status = 'picked_up',
         picked_up_at = now(),
         commission_percent = v_percent,
         commission_cents = round(v_res.total_cents * v_percent / 100)::int
   where id = v_res.id;
  return v_res.id;
end;
$$;

-- 6) Funções do admin -------------------------------------------------------------------------------------------
create or replace function public.set_platform_commission(p_percent numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Só administradores podem mudar a comissão.' using errcode = 'P0001';
  end if;
  if p_percent is null or p_percent < 0 or p_percent > 50 then
    raise exception 'A comissão precisa ficar entre 0%% e 50%%.' using errcode = 'P0001';
  end if;
  update public.platform_settings set commission_percent = round(p_percent, 2), updated_at = now(), updated_by = auth.uid() where id;
  return round(p_percent, 2);
end;
$$;

-- p_percent null = remove a taxa especial (a loja volta para a taxa padrão).
create or replace function public.set_partner_commission(p_partner_id uuid, p_percent numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Só administradores podem mudar a comissão.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.partners p where p.id = p_partner_id) then
    raise exception 'Empresa não encontrada.' using errcode = 'P0001';
  end if;

  if p_percent is null then
    delete from public.partner_commissions where partner_id = p_partner_id;
    return null;
  end if;
  if p_percent < 0 or p_percent > 50 then
    raise exception 'A comissão precisa ficar entre 0%% e 50%%.' using errcode = 'P0001';
  end if;

  insert into public.partner_commissions (partner_id, commission_percent, updated_at, updated_by)
  values (p_partner_id, round(p_percent, 2), now(), auth.uid())
  on conflict (partner_id) do update
    set commission_percent = excluded.commission_percent, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return round(p_percent, 2);
end;
$$;

revoke execute on function public.confirm_pickup(uuid, text) from public, anon;
grant execute on function public.confirm_pickup(uuid, text) to authenticated;
revoke execute on function public.set_platform_commission(numeric) from public, anon;
grant execute on function public.set_platform_commission(numeric) to authenticated;
revoke execute on function public.set_partner_commission(uuid, numeric) from public, anon;
grant execute on function public.set_partner_commission(uuid, numeric) to authenticated;
grant select on public.platform_settings to authenticated;
grant select on public.partner_commissions to authenticated;
