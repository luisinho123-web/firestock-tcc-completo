// Edge Function `notify-order-status`: envia o aviso de mudança de pedido pelo canal que o usuário escolheu.
//
// Quem chama: o gatilho `reservations_queue_notification` do banco (supabase/migrations/notifications_delivery.sql),
// com { "outbox_id": "<uuid>" }; ou um agendamento opcional com { "flush": true } para reenviar o que ficou pendente.
// Segurança: a chamada precisa levar o cabeçalho `x-webhook-secret` igual ao segredo NOTIFY_WEBHOOK_SECRET, por isso a
// função é publicada SEM verificação de JWT:  supabase functions deploy notify-order-status --no-verify-jwt
//
// Segredos (supabase secrets set ...), detalhes em docs/NOTIFICACOES.md:
//   NOTIFY_WEBHOOK_SECRET        obrigatório (o mesmo valor guardado no Vault do banco como notify_webhook_secret)
//   EXPO_ACCESS_TOKEN            opcional (só se você ligou "enhanced push security" no Expo)
//   WHATSAPP_TOKEN               token de acesso da WhatsApp Business Cloud API
//   WHATSAPP_PHONE_NUMBER_ID     id do número remetente
//   WHATSAPP_TEMPLATE_NAME       modelo aprovado (padrão: atualizacao_pedido)
//   WHATSAPP_TEMPLATE_LANG       idioma do modelo (padrão: pt_BR)
//   WHATSAPP_API_VERSION         versão da Graph API (padrão: v21.0)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem dentro das Edge Functions.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { deliver, type Channel, type Deps, type Recipient } from '../_shared/deliver.ts';
import {
  buildExpoMessages,
  chunk,
  EXPO_BATCH_SIZE,
  EXPO_PUSH_URL,
  mergeOutcomes,
  parseExpoResponse,
  type PushOutcome,
} from '../_shared/expo-push.ts';
import { buildOrderMessage, isOrderEvent, type Fulfillment, type OrderMessage } from '../_shared/messages.ts';
import {
  buildWhatsAppRequest,
  DEFAULT_API_VERSION,
  DEFAULT_LANGUAGE,
  DEFAULT_TEMPLATE_NAME,
  parseWhatsAppResponse,
  type WhatsAppConfig,
  type WhatsAppResult,
} from '../_shared/whatsapp.ts';

const MAX_ATTEMPTS = 5;
const FLUSH_LIMIT = 50;
const FLUSH_WINDOW_MS = 24 * 60 * 60 * 1000;
const HTTP_TIMEOUT_MS = 10_000;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Compara sem pistas de tempo (a diferença de tamanho já é pública, o conteúdo não). */
function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function whatsAppConfig(): WhatsAppConfig | null {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    templateName: Deno.env.get('WHATSAPP_TEMPLATE_NAME') || DEFAULT_TEMPLATE_NAME,
    language: Deno.env.get('WHATSAPP_TEMPLATE_LANG') || DEFAULT_LANGUAGE,
    apiVersion: Deno.env.get('WHATSAPP_API_VERSION') || DEFAULT_API_VERSION,
  };
}

const deps: Deps = {
  async sendPush(tokens: string[], message: OrderMessage, data: Record<string, unknown>): Promise<PushOutcome> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (expoToken) headers.Authorization = `Bearer ${expoToken}`;

    const parts: PushOutcome[] = [];
    for (const batch of chunk(tokens, EXPO_BATCH_SIZE)) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(buildExpoMessages(batch, message, data)),
          signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        });
        parts.push(parseExpoResponse(batch, await response.json().catch(() => null)));
      } catch (error) {
        parts.push({ sent: 0, failed: batch.length, invalidTokens: [], errors: [error instanceof Error ? error.message : 'erro de rede'] });
      }
    }
    return mergeOutcomes(parts);
  },

  async sendWhatsApp(phone: string, message: OrderMessage): Promise<WhatsAppResult> {
    const config = whatsAppConfig();
    if (!config) return { ok: false, error: 'WhatsApp não configurado (faltam WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID)' };
    const request = buildWhatsAppRequest(config, phone, message);
    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      return parseWhatsAppResponse(response.status, await response.json().catch(() => null));
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'erro de rede' };
    }
  },

  async deleteTokens(tokens: string[]): Promise<void> {
    await admin.from('push_tokens').delete().in('token', tokens);
  },
};

type OutboxRow = { id: string; reservation_id: string; consumer_id: string; event: string; attempts: number };

type ReservationRow = {
  id: string;
  pickup_code: string;
  fulfillment: Fulfillment;
  payment_method: string | null;
  partners: { trade_name: string } | { trade_name: string }[] | null;
};

async function processRow(row: OutboxRow): Promise<{ id: string; done: boolean; note: string | null }> {
  const finish = async (done: boolean, note: string | null) => {
    await admin
      .from('notification_outbox')
      .update({ processed_at: done ? new Date().toISOString() : null, attempts: row.attempts + 1, last_error: note })
      .eq('id', row.id);
    return { id: row.id, done, note };
  };

  if (!isOrderEvent(row.event)) return finish(true, `evento desconhecido: ${row.event}`);

  const { data: reservation } = await admin
    .from('reservations')
    .select('id, pickup_code, fulfillment, payment_method, partners(trade_name)')
    .eq('id', row.reservation_id)
    .maybeSingle();
  if (!reservation) return finish(true, 'reserva não encontrada');
  const res = reservation as unknown as ReservationRow;
  const partnerName = Array.isArray(res.partners) ? res.partners[0]?.trade_name : res.partners?.trade_name;

  const { data: profile } = await admin
    .from('profiles')
    .select('notification_channel, notify_phone')
    .eq('id', row.consumer_id)
    .maybeSingle();
  const channel = ((profile as { notification_channel?: string } | null)?.notification_channel ?? 'push') as Channel;

  let tokens: string[] = [];
  if (channel === 'push') {
    const { data } = await admin.from('push_tokens').select('token').eq('user_id', row.consumer_id);
    tokens = ((data ?? []) as { token: string }[]).map((entry) => entry.token);
  }

  const recipient: Recipient = {
    channel,
    phone: (profile as { notify_phone?: string | null } | null)?.notify_phone ?? null,
    tokens,
  };
  const message = buildOrderMessage(row.event, {
    partnerName: partnerName ?? null,
    code: res.pickup_code,
    fulfillment: res.fulfillment,
    paymentMethod: res.payment_method,
  });

  // `data` vai junto do push: tocar na notificação abre o pedido (hooks/use-push-registration no app).
  const result = await deliver(recipient, message, deps, { type: 'order-status', reservationId: res.id, event: row.event });
  return finish(result.done, result.note);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return json({ error: 'método não permitido' }, 405);

  const secret = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
  if (!secret || !safeEqual(request.headers.get('x-webhook-secret') ?? '', secret)) {
    return json({ error: 'não autorizado' }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as { outbox_id?: unknown; flush?: unknown };

  let rows: OutboxRow[] = [];
  if (typeof body.outbox_id === 'string') {
    const { data } = await admin
      .from('notification_outbox')
      .select('id, reservation_id, consumer_id, event, attempts')
      .eq('id', body.outbox_id)
      .is('processed_at', null);
    rows = (data ?? []) as OutboxRow[];
  } else if (body.flush === true) {
    const { data } = await admin
      .from('notification_outbox')
      .select('id, reservation_id, consumer_id, event, attempts')
      .is('processed_at', null)
      .lt('attempts', MAX_ATTEMPTS)
      .gt('created_at', new Date(Date.now() - FLUSH_WINDOW_MS).toISOString())
      .order('created_at')
      .limit(FLUSH_LIMIT);
    rows = (data ?? []) as OutboxRow[];
  } else {
    return json({ error: 'envie outbox_id ou flush' }, 400);
  }

  const results = [];
  for (const row of rows) results.push(await processRow(row));
  return json({ processed: results.length, results });
});
