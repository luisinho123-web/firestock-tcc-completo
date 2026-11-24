import { describe, expect, it } from 'vitest';

import {
  confirmLabel,
  deadlineText,
  isCompletePickupCode,
  isOpenReservation,
  nextAction,
  normalizePickupCode,
  stageFlow,
  stageIndex,
  stageLabel,
  paymentInstruction,
  statusLabel,
} from './pickup-rules';

const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

const NOW = new Date('2026-11-17T14:00:00-03:00');

describe('normalizePickupCode', () => {
  it('aceita o código como aparece no app', () => {
    expect(normalizePickupCode('FS-123456')).toBe('123456');
    expect(normalizePickupCode(' fs 123 456 ')).toBe('123456');
  });

  it('corta no tamanho do código', () => {
    expect(normalizePickupCode('1234567890')).toBe('123456');
  });

  it('só fica completo com 6 dígitos', () => {
    expect(isCompletePickupCode('FS-12345')).toBe(false);
    expect(isCompletePickupCode('FS-123456')).toBe(true);
  });
});

describe('isOpenReservation', () => {
  it('pendente e confirmada estão em aberto', () => {
    expect(isOpenReservation('pending')).toBe(true);
    expect(isOpenReservation('confirmed')).toBe(true);
    expect(isOpenReservation('picked_up')).toBe(false);
    expect(isOpenReservation('cancelled')).toBe(false);
  });
});

describe('deadlineText', () => {
  it('sem prazo não mostra nada', () => {
    expect(deadlineText(null, NOW)).toBeNull();
  });

  it('prazo no futuro', () => {
    const result = deadlineText('2026-11-17T18:00:00-03:00', NOW);
    expect(result?.late).toBe(false);
    expect(result?.text).toMatch(/^Retirar até/);
  });

  it('prazo vencido em minutos e em horas', () => {
    expect(deadlineText('2026-11-17T13:40:00-03:00', NOW)).toEqual({ text: 'Prazo vencido há 20 min', late: true });
    expect(deadlineText('2026-11-17T11:00:00-03:00', NOW)).toEqual({ text: 'Prazo vencido há 3 h', late: true });
  });
});

describe('retirada x delivery', () => {
  it('rótulo da situação', () => {
    expect(statusLabel('picked_up', 'pickup')).toBe('Retirada');
    expect(statusLabel('picked_up', 'delivery')).toBe('Entregue');
    expect(statusLabel('pending', 'delivery')).toBe('Aguardando entrega');
    expect(statusLabel('pending', 'pickup')).toBe('Aguardando retirada');
    expect(statusLabel('cancelled', 'delivery')).toBe('Cancelada');
  });

  it('botão de confirmação', () => {
    expect(confirmLabel('pickup')).toBe('Confirmar retirada');
    expect(confirmLabel('delivery')).toBe('Confirmar entrega');
  });

  it('pagamento: cobrar na loja, na entrega ou já pago', () => {
    expect(paymentInstruction('dinheiro', 'pickup', 1290, money)).toEqual({ text: 'Cobrar no balcão: R$ 12,90', collect: true });
    expect(paymentInstruction('dinheiro', 'delivery', 2180, money)).toEqual({ text: 'Cobrar na entrega: R$ 21,80', collect: true });
    expect(paymentInstruction('pix', 'pickup', 1290, money)).toEqual({ text: 'Pago no app (Pix)', collect: false });
    expect(paymentInstruction('cartao', 'delivery', 1290, money)).toEqual({ text: 'Pago no app (cartão)', collect: false });
    expect(paymentInstruction(null, 'pickup', 1290, money)).toBeNull();
  });
});

describe('etapas marcadas pela loja', () => {
  it('nome da etapa por tipo de pedido', () => {
    expect(stageLabel('pickup', 'received')).toBe('Pedido recebido');
    expect(stageLabel('pickup', 'preparing')).toBe('Separando o pedido');
    expect(stageLabel('delivery', 'preparing')).toBe('Separando os produtos');
    expect(stageLabel('pickup', 'ready')).toBe('Pronto para retirar');
    expect(stageLabel('delivery', 'out_for_delivery')).toBe('Pedido a caminho');
  });

  it('retirada: separar -> pronto -> confirmar retirada', () => {
    expect(nextAction('pickup', 'received')).toEqual({ kind: 'advance', stage: 'preparing', label: 'Começar a separar' });
    expect(nextAction('pickup', 'preparing')).toEqual({ kind: 'advance', stage: 'ready', label: 'Pronto para retirar' });
    expect(nextAction('pickup', 'ready')).toEqual({ kind: 'complete', label: 'Confirmar retirada' });
  });

  it('delivery: separar -> a caminho -> confirmar entrega', () => {
    expect(nextAction('delivery', 'received')).toEqual({ kind: 'advance', stage: 'preparing', label: 'Começar a separar' });
    expect(nextAction('delivery', 'preparing')).toEqual({ kind: 'advance', stage: 'out_for_delivery', label: 'Saiu para entrega' });
    expect(nextAction('delivery', 'out_for_delivery')).toEqual({ kind: 'complete', label: 'Confirmar entrega' });
  });

  it('fluxo e posição', () => {
    expect(stageFlow('pickup')).toHaveLength(4);
    expect(stageFlow('delivery')[3]).toBe('Pedido entregue');
    expect(stageIndex('received')).toBe(0);
    expect(stageIndex('preparing')).toBe(1);
    expect(stageIndex('ready')).toBe(2);
    expect(stageIndex('out_for_delivery')).toBe(2);
  });
});
