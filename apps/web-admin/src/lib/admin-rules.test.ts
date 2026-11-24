import { describe, expect, it } from 'vitest';

import {
  NO_CATEGORY,
  periodStart,
  REMOVED_PRODUCT,
  summarizeAdmin,
  UNKNOWN_PARTNER,
  type CategoryRef,
  type PartnerRef,
  type ProductRef,
  type SaleOrder,
  type SaleStatus,
} from './admin-rules';

// Meio-dia local, para o teste não depender de fuso horário.
const NOW = new Date(2026, 10, 17, 12, 0, 0);
const daysAgo = (days: number) => new Date(2026, 10, 17 - days, 10, 0, 0).toISOString();

const categories: CategoryRef[] = [
  { id: 'c-fruit', name: 'Frutas' },
  { id: 'c-drink', name: 'Bebidas' },
];
const partners: PartnerRef[] = [
  { id: 'a', trade_name: 'Mercado A', status: 'approved', category: 'Mercado', created_at: daysAgo(100) },
  { id: 'b', trade_name: 'Mercado B', status: 'approved', category: 'Mercado', created_at: daysAgo(90) },
  { id: 'c', trade_name: 'Padaria C', status: 'pending', category: 'Padaria', created_at: daysAgo(2) },
  { id: 'd', trade_name: 'Loja D', status: 'pending', category: null, created_at: daysAgo(5) },
  { id: 'e', trade_name: 'Loja E', status: 'rejected', category: null, created_at: daysAgo(50) },
];
const products: ProductRef[] = [
  { id: 'p-apple', name: 'Maçã', category_id: 'c-fruit', partner_id: 'a' },
  { id: 'p-juice', name: 'Suco', category_id: 'c-drink', partner_id: 'b' },
  { id: 'p-misc', name: 'Sem cat', category_id: null, partner_id: 'a' },
];

let counter = 0;
function order(
  status: SaleStatus,
  when: string,
  items: [string, number, number][],
  extra: { consumer?: string; partner?: string } = {},
): SaleOrder {
  counter += 1;
  return {
    id: `o${counter}`,
    consumer_id: extra.consumer ?? 'u1',
    partner_id: extra.partner ?? 'a',
    status,
    created_at: when,
    picked_up_at: status === 'picked_up' ? when : null,
    items: items.map(([product_id, quantity, unit_price_cents]) => ({ product_id, quantity, unit_price_cents })),
  };
}

const run = (orders: SaleOrder[], period: 7 | 30 | 90 | 'all' = 30) => summarizeAdmin(orders, products, partners, categories, period, NOW);

describe('summarizeAdmin: vendas', () => {
  it('receita da plataforma soma as comissões gravadas, separada do volume vendido', () => {
    const withCommission = (sale: SaleOrder, commission: number | null): SaleOrder => ({ ...sale, commission_cents: commission });
    const data = run([
      withCommission(order('picked_up', daysAgo(1), [['p-apple', 2, 500]], { partner: 'a' }), 100), // 10%
      withCommission(order('picked_up', daysAgo(1), [['p-juice', 1, 1000]], { partner: 'b' }), 45), // 4,5% (taxa especial)
      withCommission(order('pending', daysAgo(1), [['p-apple', 1, 500]]), null), // em aberto: não conta
    ]);
    expect(data.revenueCents).toBe(2000);
    expect(data.platformRevenueCents).toBe(145);
    expect(data.byPartner.find((p) => p.partnerId === 'a')?.commissionCents).toBe(100);
    expect(data.byPartner.find((p) => p.partnerId === 'b')?.commissionCents).toBe(45);
    expect(data.daily.find((d) => d.revenueCents > 0)?.commissionCents).toBe(145);
  });

  it('soma só reservas retiradas, de todas as empresas', () => {
    const data = run([
      order('picked_up', daysAgo(1), [['p-apple', 2, 500]], { partner: 'a' }),
      order('picked_up', daysAgo(2), [['p-juice', 1, 1000]], { partner: 'b' }),
      order('pending', daysAgo(1), [['p-apple', 9, 500]]),
      order('cancelled', daysAgo(1), [['p-apple', 9, 500]]),
    ]);
    expect(data.revenueCents).toBe(2 * 500 + 1000);
    expect(data.unitsSold).toBe(3);
    expect(data.ordersCompleted).toBe(2);
    expect(data.avgTicketCents).toBe(1000);
  });

  it('ranqueia empresas por unidades e desempata por receita', () => {
    const data = run([
      order('picked_up', daysAgo(1), [['p-apple', 3, 100]], { partner: 'a' }),
      order('picked_up', daysAgo(1), [['p-juice', 3, 900]], { partner: 'b' }),
      order('picked_up', daysAgo(2), [['p-juice', 1, 900]], { partner: 'b' }),
    ]);
    expect(data.byPartner.map((p) => p.name)).toEqual(['Mercado B', 'Mercado A']);
    expect(data.byPartner[0]).toMatchObject({ units: 4, revenueCents: 3600, orders: 2 });
    expect(data.byPartner[1]).toMatchObject({ units: 3, revenueCents: 300, orders: 1 });
  });

  it('ranqueia produtos com o nome da empresa dona', () => {
    const data = run([order('picked_up', daysAgo(1), [['p-apple', 3, 100], ['p-juice', 1, 900]], { partner: 'a' })]);
    expect(data.topProducts[0]).toMatchObject({ name: 'Maçã', partnerName: 'Mercado A', category: 'Frutas', units: 3 });
    expect(data.topProducts[1]).toMatchObject({ name: 'Suco', partnerName: 'Mercado B', category: 'Bebidas' });
  });

  it('agrupa por categoria e usa "Sem categoria" quando falta', () => {
    const data = run([order('picked_up', daysAgo(1), [['p-apple', 4, 100], ['p-juice', 1, 100], ['p-misc', 2, 100]])]);
    expect(data.byCategory.map((c) => [c.category, c.units])).toEqual([
      ['Frutas', 4],
      [NO_CATEGORY, 2],
      ['Bebidas', 1],
    ]);
  });

  it('produto e empresa que não existem mais aparecem com nome genérico', () => {
    const data = run([order('picked_up', daysAgo(1), [['p-gone', 1, 100]], { partner: 'zzz' })]);
    expect(data.topProducts[0].name).toBe(REMOVED_PRODUCT);
    expect(data.topProducts[0].partnerName).toBe(UNKNOWN_PARTNER);
    expect(data.byPartner[0].name).toBe(UNKNOWN_PARTNER);
  });

  it('filtra pelo período, inclusive o primeiro dia, e "all" pega tudo', () => {
    const orders = [
      order('picked_up', daysAgo(0), [['p-apple', 1, 100]]),
      order('picked_up', daysAgo(6), [['p-apple', 1, 100]]),
      order('picked_up', daysAgo(7), [['p-apple', 1, 100]]),
      order('picked_up', daysAgo(200), [['p-apple', 1, 100]]),
    ];
    expect(run(orders, 7).ordersCompleted).toBe(2);
    expect(run(orders, 30).ordersCompleted).toBe(3);
    expect(run(orders, 'all').ordersCompleted).toBe(4);
  });
});

describe('summarizeAdmin: usuários e reservas', () => {
  it('usuários ativos = consumidores diferentes com reserva (qualquer status) no período', () => {
    const data = run([
      order('picked_up', daysAgo(1), [], { consumer: 'u1' }),
      order('cancelled', daysAgo(2), [], { consumer: 'u1' }),
      order('pending', daysAgo(3), [], { consumer: 'u2' }),
      order('picked_up', daysAgo(100), [], { consumer: 'u3' }), // fora do período
    ]);
    expect(data.activeUsers).toBe(2);
    expect(run([order('picked_up', daysAgo(100), [], { consumer: 'u3' })], 'all').activeUsers).toBe(1);
  });

  it('conta reservas por status, na ordem fixa, incluindo zeros', () => {
    const data = run([
      order('picked_up', daysAgo(1), []),
      order('picked_up', daysAgo(2), []),
      order('cancelled', daysAgo(1), []),
      order('no_show', daysAgo(1), []),
      order('pending', daysAgo(100), []), // fora do período
    ]);
    expect(data.ordersInPeriod).toBe(4);
    expect(data.byStatus.map((s) => [s.status, s.count])).toEqual([
      ['picked_up', 2],
      ['confirmed', 0],
      ['pending', 0],
      ['cancelled', 1],
      ['expired', 0],
      ['no_show', 1],
    ]);
  });
});

describe('summarizeAdmin: empresas e série diária', () => {
  it('conta empresas por situação e lista as pendentes da mais antiga para a mais nova', () => {
    const data = run([]);
    expect(data.partnerCounts).toEqual({ pending: 2, approved: 2, rejected: 1 });
    expect(data.pendingPartners.map((p) => p.trade_name)).toEqual(['Loja D', 'Padaria C']);
  });

  it('série diária preenche os dias sem venda com zero', () => {
    const data = run([order('picked_up', daysAgo(2), [['p-apple', 2, 250]])], 7);
    expect(data.daily).toHaveLength(7);
    expect(data.daily.filter((d) => d.revenueCents > 0)).toEqual([expect.objectContaining({ revenueCents: 500, units: 2 })]);
  });

  it('"todo o período" começa no primeiro dia com venda; sem vendas, sem série', () => {
    expect(run([order('picked_up', daysAgo(3), [['p-apple', 1, 100]])], 'all').daily).toHaveLength(4);
    expect(run([], 'all').daily).toEqual([]);
  });

  it('sem nada: tudo zerado', () => {
    const data = run([]);
    expect(data).toMatchObject({ revenueCents: 0, unitsSold: 0, ordersCompleted: 0, avgTicketCents: 0, ordersInPeriod: 0, activeUsers: 0 });
    expect(data.topProducts).toEqual([]);
    expect(data.byPartner).toEqual([]);
  });

  it('ticket médio arredonda ao centavo', () => {
    const data = run([
      order('picked_up', daysAgo(1), [['p-apple', 1, 100]]),
      order('picked_up', daysAgo(1), [['p-apple', 1, 101]]),
      order('picked_up', daysAgo(1), [['p-apple', 1, 101]]),
    ]);
    expect(data.avgTicketCents).toBe(101);
  });
});

describe('periodStart', () => {
  it('7 dias = hoje e os 6 anteriores, à meia-noite', () => {
    expect(periodStart(7, NOW)).toEqual(new Date(2026, 10, 11, 0, 0, 0));
    expect(periodStart('all', NOW)).toBeNull();
  });
});
