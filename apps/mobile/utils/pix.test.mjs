import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPixPayload, crc16, PLACEHOLDER_PIX_KEY, sanitizePixText, sanitizeTxid } from './pix.ts';

/** Lê os campos EMV (id, tamanho, valor) de um trecho do código. */
function parseTlv(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const id = text.slice(i, i + 2);
    const length = Number(text.slice(i + 2, i + 4));
    out.push({ id, value: text.slice(i + 4, i + 4 + length) });
    i += 4 + length;
  }
  return out;
}

test('crc16 bate com o valor de verificação padrão do CRC-16/CCITT-FALSE', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('o código gerado tem os campos certos e o CRC confere', () => {
  const payload = buildPixPayload({ key: 'maria@example.com', name: 'Mercado São João', city: 'Cascavel', amount: 12.9, txid: 'FS-2024-ABC' });

  assert.ok(payload.endsWith(crc16(payload.slice(0, -4)).toString()));
  assert.equal(payload.slice(-8, -4), '6304');

  const fields = parseTlv(payload.slice(0, -8));
  const byId = Object.fromEntries(fields.map((f) => [f.id, f.value]));
  assert.equal(byId['00'], '01');
  assert.equal(byId['52'], '0000');
  assert.equal(byId['53'], '986');
  assert.equal(byId['54'], '12.90');
  assert.equal(byId['58'], 'BR');
  assert.equal(byId['59'], 'MERCADO SAO JOAO');
  assert.equal(byId['60'], 'CASCAVEL');

  const account = Object.fromEntries(parseTlv(byId['26']).map((f) => [f.id, f.value]));
  assert.equal(account['00'], 'br.gov.bcb.pix');
  assert.equal(account['01'], 'maria@example.com');

  assert.deepEqual(parseTlv(byId['62']), [{ id: '05', value: 'FS2024ABC' }]);
});

test('formata o valor com 2 casas e sem erro de ponto flutuante', () => {
  const value = (amount) => parseTlv(buildPixPayload({ key: 'k', name: 'N', city: 'C', amount }).slice(0, -8)).find((f) => f.id === '54')?.value;
  assert.equal(value(1), '1.00');
  assert.equal(value(0.1 + 0.2), '0.30');
  assert.equal(value(1234.5), '1234.50');
  assert.equal(value(19.99), '19.99');
  assert.equal(value(0.01), '0.01');
});

test('sem valor (ou zero), omite o campo 54', () => {
  for (const amount of [undefined, 0, -5]) {
    const fields = parseTlv(buildPixPayload({ key: 'k', name: 'N', city: 'C', amount }).slice(0, -8));
    assert.equal(fields.some((f) => f.id === '54'), false);
  }
});

test('nome e cidade respeitam os limites (25 e 15) e saem sem acento', () => {
  assert.equal(sanitizePixText('Supermercado Ação & Cia Ltda Muito Grande', 25), 'SUPERMERCADO ACAO CIA LTD');
  assert.equal(sanitizePixText('São José dos Pinhais', 15), 'SAO JOSE DOS PI');
  assert.equal(sanitizePixText('   ', 25), '');
});

test('txid só aceita letras e números, até 25, e usa *** quando vazio', () => {
  assert.equal(sanitizeTxid('FS-123_abc'), 'FS123abc');
  assert.equal(sanitizeTxid('x'.repeat(40)).length, 25);
  assert.equal(sanitizeTxid(''), '***');
  assert.equal(sanitizeTxid('---'), '***');
});

test('chave vazia é recusada', () => {
  assert.throws(() => buildPixPayload({ key: '  ', name: 'N', city: 'C' }), /chave/i);
});

test('a chave de teste é um UUID que não pertence a ninguém', () => {
  assert.match(PLACEHOLDER_PIX_KEY, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
