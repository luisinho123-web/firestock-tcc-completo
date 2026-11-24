/**
 * Preferências de aviso de pedido e aparelhos que recebem push.
 * Colunas de public.profiles: notification_channel ('push' | 'whatsapp' | 'none'), notify_phone (55 + DDD + número, só dígitos),
 * notification_consent_at. Aparelhos: tabela push_tokens, gravada só por register_push_token / unregister_push_token.
 * Os avisos em si saem do servidor (Edge Function notify-order-status), não daqui.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { fromWhatsAppNumber, toWhatsAppNumber } from '@/utils/whatsapp-phone';

export type NotificationChannel = 'push' | 'whatsapp' | 'none';

export type NotificationPrefs = {
  channel: NotificationChannel;
  /** Dígitos nacionais (DDD + número), prontos para a máscara do campo; vazio se não há número. */
  phoneDigits: string;
};

/** O banco entrega 'push' por padrão a quem nunca escolheu. */
export const DEFAULT_PREFS: NotificationPrefs = { channel: 'push', phoneDigits: '' };

export function isNotificationChannel(value: unknown): value is NotificationChannel {
  return value === 'push' || value === 'whatsapp' || value === 'none';
}

export function createNotificationPrefsService(client: SupabaseClient) {
  /** Nunca rejeita: sem rede ou sem a coluna, vale o padrão. */
  async function getPrefs(userId: string): Promise<NotificationPrefs> {
    try {
      const { data, error } = await client.from('profiles').select('notification_channel, notify_phone').eq('id', userId).single();
      if (error || !data) return DEFAULT_PREFS;
      const row = data as { notification_channel: unknown; notify_phone: string | null };
      return {
        channel: isNotificationChannel(row.notification_channel) ? row.notification_channel : 'push',
        phoneDigits: fromWhatsAppNumber(row.notify_phone),
      };
    } catch {
      return DEFAULT_PREFS;
    }
  }

  /**
   * Salva a escolha. O número é validado aqui (mensagem clara) e de novo no banco. Escolher WhatsApp conta como o aceite de
   * receber mensagens nesse número (notification_consent_at); os outros canais não mexem nesse registro.
   */
  async function savePrefs(userId: string, input: { channel: NotificationChannel; phone: string }): Promise<NotificationPrefs> {
    const stored = toWhatsAppNumber(input.phone);
    if (input.channel === 'whatsapp' && !stored) throw new Error('Informe um celular válido com DDD para receber no WhatsApp.');

    // Em outro canal, um número incompleto não é gravado (stored fica null): o campo só importa para o WhatsApp.
    const update: Record<string, unknown> = { notification_channel: input.channel, notify_phone: stored };
    if (input.channel === 'whatsapp') update.notification_consent_at = new Date().toISOString();

    const { error } = await client.from('profiles').update(update).eq('id', userId);
    if (error) {
      if (error.code === '23514') throw new Error('O número de WhatsApp não é válido. Confira o DDD e o número.');
      throw new Error('Não foi possível salvar suas preferências. Tente novamente.');
    }
    return { channel: input.channel, phoneDigits: fromWhatsAppNumber(stored) };
  }

  /** Associa o token deste aparelho ao usuário logado (se o aparelho já era de outra conta, passa para esta). */
  async function registerPushToken(token: string, platform: 'android' | 'ios'): Promise<void> {
    const { error } = await client.rpc('register_push_token', { p_token: token, p_platform: platform });
    if (error) throw new Error('Não foi possível ativar as notificações neste aparelho.');
  }

  /** Tira este aparelho da lista de push; falha silenciosa (o servidor também confere o canal escolhido). */
  async function unregisterPushToken(token: string): Promise<void> {
    await client.rpc('unregister_push_token', { p_token: token });
  }

  return { getPrefs, savePrefs, registerPushToken, unregisterPushToken };
}
