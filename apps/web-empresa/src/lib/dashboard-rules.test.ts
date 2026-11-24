import { describe, expect, it } from 'vitest';

import { NO_CATEGORY, periodStart, REMOVED_PRODUCT, summarize, type CategoryRef, type ProductRef, type SaleOrder, type SaleStatus } from './dashboard-rules';

// Meio-dia local, para o teste não depender de fuso horário.
const NOW = new Date(2026, 10, 17, 12, 0, 0);
const daysAgo = (days: number) => new Date(2026, 10, 17 - days, 10, 0, 0).toISOString();

const categories: CategoryRef[] = [
  { id: 'c-fruit', name: 'Frutas' },
  { id: 'c-drink', name: 'Bebidas' },
];
const products: ProductRef[] = [
  { id: 'p-apple', name: 'Maçã', category_id: 'c-fruit' },
  { id: 'p-juice', name: 'Suco', category_id: 'c-drink' },
  { id: 'p-misc', name: 'Sem cat', category_id: null },
];

let counter = 0;
function order(status: SaleStatus, when: string, items: [string, number, number][]): SaleOrder {
  counter += 1;
  return {
    id: `o${counter}`,
    status,
    created_at: when,
    picked_up_at: status === 'picked_up' ? when : null,
    items: items.map(([product_id, quantity, unit_price_cents]) => ({ product_id, quantity, unit_price_cents })),
  };
}

describe('summarize', () => {
  it('comissão e valor líquido usam a comissão gravada em cada venda', () => {
    const withCommission = (sale: SaleOrder, commission: number | null): SaleOrder => ({ ...sale, commission_cents: commission });
    const data = summarize(
      [
        withCommission(order('picked_up', daysAgo(1), [['p-apple', 2, 500]]), 100), // 10%
        withCommission(order('picked_up', daysAgo(2), [['p-juice', 1, 1000]]), 45), // 4,5% (taxa especial)
        withCommission(order('pending', daysAgo(1), [['p-apple', 1, 500]]), null), // em aberto: não conta
      ],
      products,
      categories,
      30,
      NOW,
    );
    expect(data.revenueCents).toBe(2000);
    expect(data.commissionCents).toBe(145);
    expect(data.netCents).toBe(1855);
  });

  it('soma só reservas retiradas (picked_up)', () => {
    const data = summarize(
      [
        order('picked_up', daysAgo(1), [['p-apple', 2, 500]]),
        order('picked_up', daysAgo(2), [['p-juice', 1, 1000]]),
        order('pending', daysAgo(1), [['p-apple', 9, 500]]),
        order('cancelled', daysAgo(1), [['p-apple', 9, 500]]),
      ],
      products,
      categories,
      30,
      NOW,
    );
    expect(data.revenueCents).toBe(2 * 500 + 1000);
    expect(data.unitsSold).toBe(3);
    expect(data.ordersCompleted).toBe(2);
    expect(data.avgTicketCents).toBe(1000);
  });

  it('ranqueia produtos por unidades e desempata por receita', () => {
    const data = summarize(
      [
        order('picked_up', daysAgo(1), [['p-apple', 3, 100], ['p-juice', 3, 900]]),
        order('picked_up', daysAgo(2), [['p-misc', 1, 100]]),
      ],
      products,
      categories,
      30,
      NOW,
    );
    expect(data.topProducts.map((p) => p.name)).toEqual(['Suco', 'Maçã', 'Sem cat']);
    expect(data.topProducts[0]).toMatchObject({ units: 3, revenueCents: 2700, category: 'Bebidas' });
  });

  it('agrupa por categoria e usa "Sem categoria" quando falta', () => {
    const data = summarize(
      [order('picked_up', daysAgo(1), [['p-apple', 4, 100], ['p-juice', 1, 100], ['p-misc', 2, 100]])],
      products,
      categories,
      30,
      NOW,
    );
    expect(data.byCategory.map((c) => [c.category, c.units])).toEqual([
      ['Frutas', 4],
      [NO_CATEGORY, 2],
      ['Bebidas', 1],
    ]);
  });

  it('produto apagado do cadastro aparece como "Produto removido"', () => {
    const data = summarize([order('picked_up', daysAgo(1), [['p-gone', 1, 100]])], products, categories, 30, NOW);
    expect(data.topProducts[0].name).toBe(REMOVED_PRODUCT);
    expect(data.topProducts[0].category).toBe(NO_CATEGORY);
  });

  it('filtra pelo período, inclusive o primeiro dia, e "all" pega tudo', () => {
    const orders = [
      order('picked_up', daysAgo(0), [['p-apple', 1, 100]]),
      order('picked_up', daysAgo(6), [['p-apple', 1, 100]]), // 7º dia: ainda dentro de "7 dias"
      order('picked_up', daysAgo(7), [['p-apple', 1, 100]]), // fora
      order('picked_up', daysAgo(200), [['p-apple', 1, 100]]),
    ];
    expect(summarize(orders, products, categories, 7, NOW).ordersCompleted).toBe(2);
    expect(summarize(orders, products, categories, 30, NOW).ordersCompleted).toBe(3);
    expect(summarize(orders, products, categories, 'all', NOW).ordersCompleted).toBe(4);
  });

  it('reservas em aberto ignoram o período; não concluídas respeitam', () => {
    const data = summarize(
      [
        order('pending', daysAgo(100), []),
        order('confirmed', daysAgo(1), []),
        order('cancelled', daysAgo(1), []),
        order('no_show', daysAgo(2), []),
        order('expired', daysAgo(100), []),
      ],
      products,
      categories,
      7,
      NOW,
    );
    expect(data.openReservations).toBe(2);
    expect(data.notCompleted).toBe(2);
  });

  it('série diária preenche os dias sem venda com zero', () => {
    const data = summarize([order('picked_up', daysAgo(2), [['p-apple', 2, 250]])], products, categories, 7, NOW);
    expect(data.daily).toHaveLength(7);
    expect(data.daily[data.daily.length - 1]).toMatchObject({ revenueCents: 0, units: 0 });
    expect(data.daily.filter((d) => d.revenueCents > 0)).toEqual([expect.objectContaining({ revenueCents: 500, units: 2 })]);
  });

  it('"todo o período" começa no primeiro dia com venda; sem vendas, sem série', () => {
    const withSale = summarize([order('picked_up', daysAgo(3), [['p-apple', 1, 100]])], products, categories, 'all', NOW);
    expect(withSale.daily).toHaveLength(4);
    expect(summarize([], products, categories, 'all', NOW).daily).toEqual([]);
  });

  it('sem vendas: tudo zerado', () => {
    const data = summarize([], products, categories, 30, NOW);
    expect(data).toMatchObject({ revenueCents: 0, unitsSold: 0, ordersCompleted: 0, avgTicketCents: 0, openReservations: 0, notCompleted: 0 });
    expect(data.topProducts).toEqual([]);
    expect(data.byCategory).toEqual([]);
  });

  it('ticket médio arredonda ao centavo', () => {
    const data = summarize(
      [order('picked_up', daysAgo(1), [['p-apple', 1, 100]]), order('picked_up', daysAgo(1), [['p-apple', 1, 101]]), order('picked_up', daysAgo(1), [['p-apple', 1, 101]])],
      products,
      categories,
      30,
      NOW,
    );
    expect(data.avgTicketCents).toBe(101); // 302 / 3 = 100,67 → 101
  });
});

describe('periodStart', () => {
  it('7 dias = hoje e os 6 anteriores, à meia-noite', () => {
    expect(periodStart(7, NOW)).toEqual(new Date(2026, 10, 11, 0, 0, 0));
    expect(periodStart('all', NOW)).toBeNull();
  });
});
