import test from 'node:test';
import assert from 'node:assert/strict';

import { deliver } from './deliver.ts';
import { buildExpoMessages, chunk, mergeOutcomes, parseExpoResponse } from './expo-push.ts';
import { buildOrderMessage, isOrderEvent, ORDER_EVENTS } from './messages.ts';
import { buildWhatsAppRequest, parseWhatsAppResponse, whatsappText } from './whatsapp.ts';

const ctx = { partnerName: 'Mercado Central', code: 'AB12CD', fulfillment: 'pickup' };

// ---------------------------------------------------------------------------------------------------------- mensagens
test('todo evento gera título e texto com o código do pedido', () => {
  for (const event of ORDER_EVENTS) {
    const message = buildOrderMessage(event, ctx);
    assert.ok(message.title.length > 0, event);
    assert.ok(message.body.includes('Mercado Central'), event);
    if (event !== 'completed') assert.ok(message.body.includes('#AB12CD'), event);
  }
});

test('o texto muda entre retirada e delivery', () => {
  assert.equal(buildOrderMessage('preparing', ctx).title, 'Separando o seu pedido');
  assert.equal(buildOrderMessage('preparing', { ...ctx, fulfillment: 'delivery' }).title, 'Separando os seus produtos');
  assert.equal(buildOrderMessage('completed', ctx).title, 'Pedido retirado. Como foi?');
  assert.equal(buildOrderMessage('completed', { ...ctx, fulfillment: 'delivery' }).title, 'Pedido entregue. Como foi?');
});

test('os textos concordam em português, com e sem nome da loja', () => {
  assert.equal(buildOrderMessage('ready', ctx).body, 'Seu pedido #AB12CD está pronto na loja Mercado Central. Mostre o código no balcão.');
  assert.equal(buildOrderMessage('preparing', ctx).body, 'A loja Mercado Central começou a separar o pedido #AB12CD.');
  assert.equal(buildOrderMessage('ready', { ...ctx, partnerName: null }).body, 'Seu pedido #AB12CD está pronto na loja. Mostre o código no balcão.');
  assert.equal(buildOrderMessage('preparing', { ...ctx, partnerName: '  ' }).body, 'A loja começou a separar o pedido #AB12CD.');
  for (const event of ORDER_EVENTS) {
    assert.doesNotMatch(buildOrderMessage(event, ctx).body, /\bem a\b/, `"em a" no evento ${event}`);
  }
});

test('cancelamento fala em estorno, menos quando o pagamento foi em dinheiro', () => {
  assert.match(buildOrderMessage('cancelled', { ...ctx, paymentMethod: 'pix' }).body, /estornado/);
  assert.match(buildOrderMessage('cancelled', ctx).body, /estornado/);
  assert.doesNotMatch(buildOrderMessage('cancelled', { ...ctx, paymentMethod: 'dinheiro' }).body, /estornado/);
});

test('isOrderEvent só aceita os eventos do banco', () => {
  assert.equal(isOrderEvent('ready'), true);
  assert.equal(isOrderEvent('picked_up'), false);
  assert.equal(isOrderEvent(undefined), false);
});

// ------------------------------------------------------------------------------------------------------------- Expo
test('buildExpoMessages cria uma mensagem por aparelho no canal de pedidos', () => {
  const messages = buildExpoMessages(['ExponentPushToken[a]', 'ExponentPushToken[b]'], { title: 'T', body: 'B' }, { reservationId: 'r1' });
  assert.equal(messages.length, 2);
  assert.deepEqual(messages[0], {
    to: 'ExponentPushToken[a]',
    title: 'T',
    body: 'B',
    data: { reservationId: 'r1' },
    sound: 'default',
    channelId: 'orders',
    priority: 'high',
  });
});

test('parseExpoResponse conta enviados, falhas e tokens inválidos pela ordem dos tickets', () => {
  const tokens = ['t1', 't2', 't3'];
  const outcome = parseExpoResponse(tokens, {
    data: [{ status: 'ok', id: 'x' }, { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }, { status: 'error', message: 'limite' }],
  });
  assert.equal(outcome.sent, 1);
  assert.equal(outcome.failed, 2);
  assert.deepEqual(outcome.invalidTokens, ['t2']);
  assert.deepEqual(outcome.errors, ['DeviceNotRegistered', 'limite']);
});

test('parseExpoResponse trata resposta quebrada como falha de todos', () => {
  for (const body of [null, {}, { errors: [{ message: 'PUSH_TOO_MANY_EXPERIENCE_IDS' }] }, 'texto']) {
    const outcome = parseExpoResponse(['a', 'b'], body);
    assert.equal(outcome.sent, 0);
    assert.equal(outcome.failed, 2);
  }
  assert.deepEqual(parseExpoResponse(['a'], { errors: [{ message: 'erro do expo' }] }).errors, ['erro do expo']);
});

test('chunk divide em lotes e mergeOutcomes soma os resultados', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 100), []);
  const total = mergeOutcomes([
    { sent: 1, failed: 1, invalidTokens: ['a'], errors: ['x'] },
    { sent: 2, failed: 0, invalidTokens: [], errors: [] },
  ]);
  assert.deepEqual(total, { sent: 3, failed: 1, invalidTokens: ['a'], errors: ['x'] });
});

// -------------------------------------------------------------------------------------------------------- WhatsApp
test('whatsappText vira uma linha só, sem espaços repetidos nem quebras', () => {
  const text = whatsappText({ title: 'Pedido\npronto', body: 'Mostre\t o código     no balcão.' });
  assert.equal(text, 'Pedido pronto. Mostre o código no balcão.');
  assert.ok(whatsappText({ title: 'x', body: 'y'.repeat(2000) }).length <= 900);
});

test('buildWhatsAppRequest monta a chamada de modelo da Cloud API', () => {
  const request = buildWhatsAppRequest(
    { token: 'TKN', phoneNumberId: '123', templateName: 'atualizacao_pedido', language: 'pt_BR', apiVersion: 'v21.0' },
    '5545999998888',
    { title: 'Pronto', body: 'Venha buscar.' },
  );
  assert.equal(request.url, 'https://graph.facebook.com/v21.0/123/messages');
  assert.equal(request.headers.Authorization, 'Bearer TKN');
  assert.deepEqual(request.body, {
    messaging_product: 'whatsapp',
    to: '5545999998888',
    type: 'template',
    template: {
      name: 'atualizacao_pedido',
      language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Pronto. Venha buscar.' }] }],
    },
  });
});

test('parseWhatsAppResponse reconhece sucesso e traduz erros da API', () => {
  assert.deepEqual(parseWhatsAppResponse(200, { messages: [{ id: 'wamid.1' }] }), { ok: true, messageId: 'wamid.1' });
  assert.deepEqual(parseWhatsAppResponse(400, { error: { message: 'Template inexistente', code: 132001 } }), {
    ok: false,
    error: 'Template inexistente (código 132001)',
  });
  assert.deepEqual(parseWhatsAppResponse(500, null), { ok: false, error: 'HTTP 500' });
  assert.equal(parseWhatsAppResponse(200, {}).ok, false);
});

// ----------------------------------------------------------------------------------------------------------- entrega
const message = { title: 'T', body: 'B' };

function fakeDeps(overrides = {}) {
  const calls = { push: [], whatsapp: [], deleted: [] };
  const deps = {
    async sendPush(tokens) {
      calls.push.push(tokens);
      return { sent: tokens.length, failed: 0, invalidTokens: [], errors: [] };
    },
    async sendWhatsApp(phone) {
      calls.whatsapp.push(phone);
      return { ok: true, messageId: 'm' };
    },
    async deleteTokens(tokens) {
      calls.deleted.push(tokens);
    },
    ...overrides,
  };
  return { deps, calls };
}

test('canal "none" não envia nada e dá o aviso por resolvido', async () => {
  const { deps, calls } = fakeDeps();
  const result = await deliver({ channel: 'none', phone: '5545999998888', tokens: ['t'] }, message, deps);
  assert.equal(result.done, true);
  assert.deepEqual(calls, { push: [], whatsapp: [], deleted: [] });
});

test('canal push envia só por push, mesmo com telefone cadastrado, levando os dados do pedido', async () => {
  let received;
  const { deps, calls } = fakeDeps({
    async sendPush(tokens, _message, data) {
      received = data;
      return { sent: tokens.length, failed: 0, invalidTokens: [], errors: [] };
    },
  });
  const result = await deliver({ channel: 'push', phone: '5545999998888', tokens: ['a', 'b'] }, message, deps, { reservationId: 'r1' });
  assert.deepEqual(result, { done: true, note: null });
  assert.deepEqual(received, { reservationId: 'r1' });
  assert.deepEqual(calls.whatsapp, []);
});

test('canal whatsapp envia só pelo WhatsApp, mesmo com aparelhos registrados', async () => {
  const { deps, calls } = fakeDeps();
  const result = await deliver({ channel: 'whatsapp', phone: '5545999998888', tokens: ['a'] }, message, deps);
  assert.deepEqual(result, { done: true, note: null });
  assert.deepEqual(calls.whatsapp, ['5545999998888']);
  assert.deepEqual(calls.push, []);
});

test('push sem aparelho e whatsapp sem número não tentam de novo', async () => {
  const { deps } = fakeDeps();
  assert.equal((await deliver({ channel: 'push', phone: null, tokens: [] }, message, deps)).done, true);
  assert.equal((await deliver({ channel: 'whatsapp', phone: null, tokens: [] }, message, deps)).done, true);
});

test('falha do WhatsApp deixa o aviso pendente para nova tentativa', async () => {
  const { deps } = fakeDeps({ sendWhatsApp: async () => ({ ok: false, error: 'token expirado' }) });
  const result = await deliver({ channel: 'whatsapp', phone: '5545999998888', tokens: [] }, message, deps);
  assert.deepEqual(result, { done: false, note: 'WhatsApp: token expirado' });
});

test('push: token inválido é apagado; se outro aparelho recebeu, está resolvido', async () => {
  const { deps, calls } = fakeDeps({ sendPush: async () => ({ sent: 1, failed: 1, invalidTokens: ['velho'], errors: ['DeviceNotRegistered'] }) });
  const result = await deliver({ channel: 'push', phone: null, tokens: ['novo', 'velho'] }, message, deps);
  assert.equal(result.done, true);
  assert.deepEqual(calls.deleted, [['velho']]);
});

test('push: se todos os aparelhos eram inválidos, apaga e não repete', async () => {
  const { deps, calls } = fakeDeps({ sendPush: async () => ({ sent: 0, failed: 1, invalidTokens: ['velho'], errors: ['DeviceNotRegistered'] }) });
  const result = await deliver({ channel: 'push', phone: null, tokens: ['velho'] }, message, deps);
  assert.equal(result.done, true);
  assert.deepEqual(calls.deleted, [['velho']]);
});

test('push: falha passageira (sem token inválido) deixa pendente', async () => {
  const { deps, calls } = fakeDeps({ sendPush: async () => ({ sent: 0, failed: 2, invalidTokens: [], errors: ['serviço indisponível'] }) });
  const result = await deliver({ channel: 'push', phone: null, tokens: ['a', 'b'] }, message, deps);
  assert.deepEqual(result, { done: false, note: 'Push: serviço indisponível' });
  assert.deepEqual(calls.deleted, []);
});
