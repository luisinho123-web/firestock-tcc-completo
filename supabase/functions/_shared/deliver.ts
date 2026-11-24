/**
 * Decide o que fazer com um aviso conforme o canal que o usuário escolheu. Os envios de verdade entram por parâmetro
 * (deps), então a regra é testável sem rede.
 *
 * `done: true`  -> a linha da fila é dada como resolvida (enviou, ou não há o que fazer e tentar de novo não adianta).
 * `done: false` -> falha que pode passar (rede, API fora do ar): a linha continua pendente e será tentada de novo.
 */

import type { OrderMessage } from './messages.ts';
import type { PushOutcome } from './expo-push.ts';
import type { WhatsAppResult } from './whatsapp.ts';

export type Channel = 'push' | 'whatsapp' | 'none';

export type Recipient = {
  channel: Channel;
  /** profiles.notify_phone: só dígitos, com 55 na frente. */
  phone: string | null;
  tokens: string[];
};

export type Deps = {
  /** `data` vai junto do push (é o que o app usa para abrir o pedido ao tocar na notificação). */
  sendPush(tokens: string[], message: OrderMessage, data: Record<string, unknown>): Promise<PushOutcome>;
  sendWhatsApp(phone: string, message: OrderMessage): Promise<WhatsAppResult>;
  deleteTokens(tokens: string[]): Promise<void>;
};

export type Delivery = { done: boolean; note: string | null };

export async function deliver(
  recipient: Recipient,
  message: OrderMessage,
  deps: Deps,
  pushData: Record<string, unknown> = {},
): Promise<Delivery> {
  if (recipient.channel === 'none') return { done: true, note: 'usuário desativou os avisos' };

  if (recipient.channel === 'whatsapp') {
    if (!recipient.phone) return { done: true, note: 'WhatsApp escolhido, mas sem número' };
    const result = await deps.sendWhatsApp(recipient.phone, message);
    return result.ok ? { done: true, note: null } : { done: false, note: `WhatsApp: ${result.error ?? 'falha ao enviar'}` };
  }

  if (recipient.tokens.length === 0) return { done: true, note: 'nenhum aparelho registrado para push' };

  const outcome = await deps.sendPush(recipient.tokens, message, pushData);
  if (outcome.invalidTokens.length > 0) await deps.deleteTokens(outcome.invalidTokens);

  if (outcome.sent > 0) return { done: true, note: outcome.failed > 0 ? `${outcome.failed} aparelho(s) falharam` : null };
  // Nada foi enviado: se todos os aparelhos estavam inválidos não adianta repetir; senão pode ser falha passageira.
  if (outcome.invalidTokens.length === recipient.tokens.length) return { done: true, note: 'todos os aparelhos estavam inválidos (removidos)' };
  return { done: false, note: `Push: ${outcome.errors[0] ?? 'falha ao enviar'}` };
}
