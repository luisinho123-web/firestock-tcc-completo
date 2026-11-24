/**
 * Push pelo serviço do Expo (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Funções puras: montam o pedido e interpretam a resposta; quem faz o fetch é a Edge Function.
 */

import type { OrderMessage } from './messages.ts';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** O Expo aceita até 100 mensagens por chamada. */
export const EXPO_BATCH_SIZE = 100;
/** Canal de notificação do Android criado no app (hooks/use-push-registration). */
export const ANDROID_CHANNEL_ID = 'orders';

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  channelId: string;
  priority: 'high';
};

export function buildExpoMessages(tokens: string[], message: OrderMessage, data: Record<string, unknown>): ExpoMessage[] {
  return tokens.map((to) => ({ to, title: message.title, body: message.body, data, sound: 'default', channelId: ANDROID_CHANNEL_ID, priority: 'high' }));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type PushOutcome = {
  sent: number;
  failed: number;
  /** Tokens que o Expo disse que não existem mais (app desinstalado, token trocado): devem ser apagados. */
  invalidTokens: string[];
  errors: string[];
};

type Ticket = { status?: string; message?: string; details?: { error?: string } };

/** A resposta do Expo traz um "ticket" por mensagem, na mesma ordem dos tokens enviados. */
export function parseExpoResponse(tokens: string[], body: unknown): PushOutcome {
  const outcome: PushOutcome = { sent: 0, failed: 0, invalidTokens: [], errors: [] };
  const response = body as { data?: unknown; errors?: { message?: string }[] } | null;

  if (!response || !Array.isArray(response.data)) {
    outcome.failed = tokens.length;
    const reason = response?.errors?.[0]?.message ?? 'resposta inesperada do Expo';
    outcome.errors.push(reason);
    return outcome;
  }

  tokens.forEach((token, index) => {
    const ticket = (response.data as Ticket[])[index];
    if (ticket?.status === 'ok') {
      outcome.sent += 1;
      return;
    }
    outcome.failed += 1;
    if (ticket?.details?.error === 'DeviceNotRegistered') outcome.invalidTokens.push(token);
    outcome.errors.push(ticket?.details?.error ?? ticket?.message ?? 'falha ao enviar');
  });
  return outcome;
}

export function mergeOutcomes(parts: PushOutcome[]): PushOutcome {
  return parts.reduce<PushOutcome>(
    (total, part) => ({
      sent: total.sent + part.sent,
      failed: total.failed + part.failed,
      invalidTokens: [...total.invalidTokens, ...part.invalidTokens],
      errors: [...total.errors, ...part.errors],
    }),
    { sent: 0, failed: 0, invalidTokens: [], errors: [] },
  );
}
