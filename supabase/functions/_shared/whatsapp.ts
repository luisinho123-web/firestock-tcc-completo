/**
 * WhatsApp pela API oficial (WhatsApp Business Cloud API, da Meta).
 * Mensagem iniciada pela empresa fora da janela de 24 h só pode ser um MODELO (template) aprovado, então o aviso vai como
 * modelo com UMA variável ({{1}}) que recebe o texto do aviso. Passo a passo para criar o modelo: docs/NOTIFICACOES.md.
 * Funções puras: montam o pedido e interpretam a resposta; quem faz o fetch é a Edge Function.
 */

import type { OrderMessage } from './messages.ts';

export type WhatsAppConfig = {
  token: string;
  phoneNumberId: string;
  templateName: string;
  language: string;
  apiVersion: string;
};

export const DEFAULT_TEMPLATE_NAME = 'atualizacao_pedido';
export const DEFAULT_LANGUAGE = 'pt_BR';
export const DEFAULT_API_VERSION = 'v21.0';

/** O WhatsApp recusa variável de modelo com quebra de linha, tabulação ou 5+ espaços seguidos, então vira uma linha só. */
export function whatsappText(message: OrderMessage): string {
  return `${message.title}. ${message.body}`.replace(/\s+/g, ' ').trim().slice(0, 900);
}

export function buildWhatsAppRequest(config: WhatsAppConfig, to: string, message: OrderMessage) {
  return {
    url: `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: config.templateName,
        language: { code: config.language },
        components: [{ type: 'body', parameters: [{ type: 'text', text: whatsappText(message) }] }],
      },
    },
  };
}

export type WhatsAppResult = { ok: boolean; messageId?: string; error?: string };

export function parseWhatsAppResponse(httpStatus: number, body: unknown): WhatsAppResult {
  const response = body as { messages?: { id?: string }[]; error?: { message?: string; code?: number } } | null;
  const messageId = response?.messages?.[0]?.id;
  if (httpStatus >= 200 && httpStatus < 300 && messageId) return { ok: true, messageId };
  const detail = response?.error?.message ?? `HTTP ${httpStatus}`;
  return { ok: false, error: response?.error?.code ? `${detail} (código ${response.error.code})` : detail };
}
