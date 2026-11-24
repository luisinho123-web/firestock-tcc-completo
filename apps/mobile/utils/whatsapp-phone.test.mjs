import test from 'node:test';
import assert from 'node:assert/strict';

import { maskPhone } from './masks.ts';
import { fromWhatsAppNumber, toWhatsAppNumber } from './whatsapp-phone.ts';

// Mesma expressão da restrição profiles_notify_phone_check do banco: o app nunca deve produzir algo que o banco recuse.
const DB_RULE = /^55[1-9][0-9](9[0-9]{8}|[2-9][0-9]{7})$/;

test('aceita o número como a pessoa digita e devolve só dígitos com 55', () => {
  assert.equal(toWhatsAppNumber('(45) 99999-8888'), '5545999998888');
  assert.equal(toWhatsAppNumber('45999998888'), '5545999998888');
  assert.equal(toWhatsAppNumber('+55 45 99999-8888'), '5545999998888');
  assert.equal(toWhatsAppNumber('5545999998888'), '5545999998888');
  assert.equal(toWhatsAppNumber('  (11) 98765-4321  '), '5511987654321');
});

test('aceita telefone fixo de 8 dígitos', () => {
  assert.equal(toWhatsAppNumber('(45) 3225-1234'), '554532251234');
});

test('o DDD 55 (Rio Grande do Sul) não é confundido com o código do país', () => {
  assert.equal(toWhatsAppNumber('(55) 99999-8888'), '5555999998888'); // 11 dígitos: DDD 55
  assert.equal(toWhatsAppNumber('55999998888'), '5555999998888');
  assert.equal(toWhatsAppNumber('+55 55 99999-8888'), '5555999998888'); // 13 dígitos: país 55 + DDD 55
  assert.equal(toWhatsAppNumber('5555999998888'), '5555999998888');
});

test('recusa número incompleto, com DDD inválido ou celular sem o 9', () => {
  for (const bad of ['', '123', '(45) 9999-888', '(45) 99999-88', '(00) 99999-8888', '(45) 89999-8888', '4599999888800', 'abc']) {
    assert.equal(toWhatsAppNumber(bad), null, `"${bad}"`);
  }
});

test('tudo que o app aceita passa na regra do banco', () => {
  for (const input of ['(45) 99999-8888', '45999998888', '+55 11 98765-4321', '(45) 3225-1234', '(55) 99999-8888', '(21) 2222-3333']) {
    const stored = toWhatsAppNumber(input);
    assert.ok(stored && DB_RULE.test(stored), input);
  }
});

test('fromWhatsAppNumber devolve os dígitos nacionais e tolera vazio', () => {
  assert.equal(fromWhatsAppNumber('5545999998888'), '45999998888');
  assert.equal(fromWhatsAppNumber('554532251234'), '4532251234');
  assert.equal(fromWhatsAppNumber('5555999998888'), '55999998888');
  assert.equal(fromWhatsAppNumber(null), '');
  assert.equal(fromWhatsAppNumber(undefined), '');
  assert.equal(fromWhatsAppNumber(''), '');
});

test('ida e volta: o que foi guardado volta igual no campo (com a máscara da tela)', () => {
  for (const input of ['(45) 99999-8888', '(11) 98765-4321', '(45) 3225-1234', '(55) 99999-8888']) {
    assert.equal(maskPhone(fromWhatsAppNumber(toWhatsAppNumber(input))), input);
  }
});
