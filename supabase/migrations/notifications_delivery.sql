-- Notificações de pedido fora do app: push no celular OU WhatsApp, à escolha do usuário
-- (depois de reservations_stages.sql e platform_commission.sql).
-- Rode no SQL Editor do Supabase (projeto grvhxufpbvgvgurjaavb). Pode rodar de novo sem problema.
--
-- Como funciona:
--   1. O usuário escolhe o canal em "Preferências de notificação" no app (profiles.notification_channel).
--   2. Quando a loja avança, confirma ou cancela um pedido (advance_reservation, confirm_pickup, cancel_reservation),
--      o gatilho reservations_queue_notification grava um evento em notification_outbox.
--   3. O mesmo gatilho chama a Edge Function `notify-order-status` (pg_net, como o e-mail de boas-vindas), que lê o canal
--      do usuário e envia o push (Expo) ou a mensagem de WhatsApp (Meta Cloud API).
--   Nada muda no web-empresa: as funções que a loja já usa são as que disparam o aviso.
--
-- Depois de rodar este arquivo (passo a passo completo em docs/NOTIFICACOES.md):
--   a) crie o segredo compartilhado entre o banco e a função (troque pelo valor que você escolher):
--        select vault.create_secret('COLE-UM-VALOR-ALEATORIO-LONGO', 'notify_webhook_secret');
--   b) publique a função e cadastre os mesmos segredos nela (NOTIFY_WEBHOOK_SECRET, WHATSAPP_*).
--   Sem o passo (a) os eventos só ficam guardados em notification_outbox e nada é enviado.

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Preferências do usuário
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists notification_channel text not null default 'push',
  add column if not exists notify_phone text,
  add column if not exists notification_consent_at timestamptz;

alter table public.profiles drop constraint if exists profiles_notification_channel_check;
alter table public.profiles add constraint profiles_notification_channel_check
  check (notification_channel in ('push', 'whatsapp', 'none'));

-- Número de WhatsApp só com dígitos, no formato internacional do Brasil: 55 + DDD + celular (9 dígitos) ou fixo (8).
alter table public.profiles drop constraint if exists profiles_notify_phone_check;
alter table public.profiles add constraint profiles_notify_phone_check
  check (notify_phone is null or notify_phone ~ '^55[1-9][0-9](9[0-9]{8}|[2-9][0-9]{7})$');

-- Quem escolhe WhatsApp precisa ter informado o número.
alter table public.profiles drop constraint if exists profiles_whatsapp_needs_phone_check;
alter table public.profiles add constraint profiles_whatsapp_needs_phone_check
  check (notification_channel <> 'whatsapp' or notify_phone is not null);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Aparelhos que recebem push (token do Expo)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));
-- Sem política de insert/update: o app grava só pelas funções abaixo (o mesmo aparelho pode trocar de dono ao trocar de conta).

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta.' using errcode = 'P0001';
  end if;
  if p_token is null or p_token !~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Código de notificação inválido.' using errcode = 'P0001';
  end if;
  if p_platform is null or p_platform not in ('android', 'ios') then
    raise exception 'Plataforma inválida.' using errcode = 'P0001';
  end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, v_uid, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();

  -- No máximo 5 aparelhos por usuário: os mais antigos saem.
  delete from public.push_tokens
   where user_id = v_uid
     and token in (select t.token from public.push_tokens t where t.user_id = v_uid order by t.updated_at desc offset 5);
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Fila de avisos (uma linha por pedido e evento; só a Edge Function, com a chave de serviço, lê e escreve aqui)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  consumer_id uuid not null,
  event text not null check (event in ('preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  unique (reservation_id, event)
);
create index if not exists notification_outbox_pending_idx on public.notification_outbox (created_at) where processed_at is null;

-- RLS ligada e nenhuma política: nem o cliente nem o admin pelo app enxergam a fila.
alter table public.notification_outbox enable row level security;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Gatilho: a loja mudou o pedido -> registra o aviso e chama a Edge Function
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function private.queue_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_id uuid;
  v_secret text;
begin
  if new.status is not distinct from old.status and new.stage is not distinct from old.stage then
    return new;
  end if;

  -- Quem cancela o próprio pedido já sabe: o aviso é só para mudanças feitas pela loja (ou pelo admin / pelo sistema).
  if auth.uid() is not null and auth.uid() = new.consumer_id then
    return new;
  end if;

  v_event := case
    when new.status = 'picked_up' and old.status <> 'picked_up' then 'completed'
    when new.status = 'cancelled' and old.status <> 'cancelled' then 'cancelled'
    when new.status = 'expired' and old.status <> 'expired' then 'expired'
    when new.status in ('pending', 'confirmed') and new.stage = 'preparing' and old.stage is distinct from 'preparing' then 'preparing'
    when new.status in ('pending', 'confirmed') and new.stage = 'ready' and old.stage is distinct from 'ready' then 'ready'
    when new.status in ('pending', 'confirmed') and new.stage = 'out_for_delivery' and old.stage is distinct from 'out_for_delivery' then 'out_for_delivery'
    else null
  end;

  if v_event is null then
    return new;
  end if;

  insert into public.notification_outbox (reservation_id, consumer_id, event)
  values (new.id, new.consumer_id, v_event)
  on conflict (reservation_id, event) do nothing
  returning id into v_id;

  if v_id is null then
    return new;
  end if;

  -- Nunca atrapalha a loja: se a chamada falhar, o aviso continua na fila para ser reenviado depois.
  begin
    select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'notify_webhook_secret' limit 1;
    if v_secret is not null then
      perform net.http_post(
        url := 'https://grvhxufpbvgvgurjaavb.supabase.co/functions/v1/notify-order-status',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
        body := jsonb_build_object('outbox_id', v_id)
      );
    end if;
  exception when others then
    null;
  end;

  return new;
end;
$$;

revoke execute on function private.queue_order_notification() from public, anon, authenticated;

drop trigger if exists reservations_queue_notification on public.reservations;
create trigger reservations_queue_notification
  after update of status, stage on public.reservations
  for each row
  execute function private.queue_order_notification();

-- Opcional: reenviar a cada minuto o que ficou pendente (função fora do ar, falha do WhatsApp, etc.).
-- Precisa da extensão pg_cron (Database -> Extensions). Descomente para usar:
--
-- select cron.schedule('notify-order-status-flush', '* * * * *', $cron$
--   select net.http_post(
--     url := 'https://grvhxufpbvgvgurjaavb.supabase.co/functions/v1/notify-order-status',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_webhook_secret' limit 1)
--     ),
--     body := '{"flush": true}'::jsonb
--   );
-- $cron$);
