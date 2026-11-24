/**
 * Cálculos do painel de vendas. Funções puras (sem rede), para poder testar.
 *
 * O que conta como VENDA: reserva com status `picked_up` (o cliente retirou o produto).
 * Receita (vendas brutas) = soma de quantidade × preço unitário dos itens dessas reservas.
 * Comissão FireStock = commission_cents gravado em cada venda quando a loja confirmou; líquido = bruto − comissão.
 * Reservas `pending`/`confirmed` são "em aberto"; `cancelled`/`expired`/`no_show` são "não concluídas".
 */

export type SaleStatus = 'pending' | 'confirmed' | 'picked_up' | 'cancelled' | 'expired' | 'no_show';

export type SaleItem = { product_id: string; quantity: number; unit_price_cents: number };

export type SaleOrder = {
  id: string;
  status: SaleStatus;
  created_at: string;
  picked_up_at: string | null;
  /** Comissão do FireStock gravada na venda (null em pedidos ainda não concluídos). */
  commission_cents?: number | null;
  items: SaleItem[];
};

export type ProductRef = { id: string; name: string; category_id: string | null };
export type CategoryRef = { id: string; name: string };

export type Period = 7 | 30 | 90 | 'all';

export const PERIOD_LABEL: Record<string, string> = {
  '7': 'Últimos 7 dias',
  '30': 'Últimos 30 dias',
  '90': 'Últimos 90 dias',
  all: 'Todo o período',
};

export const NO_CATEGORY = 'Sem categoria';
export const REMOVED_PRODUCT = 'Produto removido';

export type ProductRank = { productId: string; name: string; category: string; units: number; revenueCents: number };
export type CategoryRank = { category: string; units: number; revenueCents: number };
export type DayPoint = { date: string; revenueCents: number; units: number };

export type DashboardData = {
  /** Vendas brutas: valor dos produtos vendidos. */
  revenueCents: number;
  /** Comissão do FireStock sobre essas vendas. */
  commissionCents: number;
  /** O que fica para a loja: bruto − comissão. */
  netCents: number;
  unitsSold: number;
  ordersCompleted: number;
  avgTicketCents: number;
  /** Reservas pending/confirmed agora, qualquer que seja o período escolhido. */
  openReservations: number;
  /** Reservas canceladas, vencidas ou não retiradas dentro do período. */
  notCompleted: number;
  topProducts: ProductRank[];
  byCategory: CategoryRank[];
  daily: DayPoint[];
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** "2026-11-17" no fuso do navegador (é o dia que a empresa enxerga). */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Primeiro instante do período (início do dia); null para "todo o período". */
export function periodStart(period: Period, now: Date): Date | null {
  if (period === 'all') return null;
  const start = startOfDay(now);
  start.setDate(start.getDate() - (period - 1));
  return start;
}

/** Data em que a venda conta: a da retirada; sem ela, a da reserva. */
function saleDate(order: SaleOrder): Date {
  return new Date(order.status === 'picked_up' ? (order.picked_up_at ?? order.created_at) : order.created_at);
}

export function summarize(
  orders: SaleOrder[],
  products: ProductRef[],
  categories: CategoryRef[],
  period: Period,
  now: Date = new Date(),
): DashboardData {
  const start = periodStart(period, now);
  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  const inPeriod = (order: SaleOrder) => {
    const when = saleDate(order);
    return (start === null || when >= start) && when <= now;
  };

  const sold = orders.filter((order) => order.status === 'picked_up' && inPeriod(order));
  const notCompleted = orders.filter(
    (order) => (order.status === 'cancelled' || order.status === 'expired' || order.status === 'no_show') && inPeriod(order),
  ).length;
  const openReservations = orders.filter((order) => order.status === 'pending' || order.status === 'confirmed').length;

  const byProduct = new Map<string, ProductRank>();
  const byCategory = new Map<string, CategoryRank>();
  const byDay = new Map<string, DayPoint>();
  let revenueCents = 0;
  let unitsSold = 0;
  let commissionCents = 0;

  for (const order of sold) {
    commissionCents += order.commission_cents ?? 0;
    const day = dateKey(saleDate(order));
    const point = byDay.get(day) ?? { date: day, revenueCents: 0, units: 0 };

    for (const item of order.items) {
      const value = item.quantity * item.unit_price_cents;
      const product = productById.get(item.product_id);
      const category = (product?.category_id && categoryName.get(product.category_id)) || NO_CATEGORY;

      revenueCents += value;
      unitsSold += item.quantity;
      point.revenueCents += value;
      point.units += item.quantity;

      const rank = byProduct.get(item.product_id) ?? {
        productId: item.product_id,
        name: product?.name ?? REMOVED_PRODUCT,
        category,
        units: 0,
        revenueCents: 0,
      };
      rank.units += item.quantity;
      rank.revenueCents += value;
      byProduct.set(item.product_id, rank);

      const categoryRank = byCategory.get(category) ?? { category, units: 0, revenueCents: 0 };
      categoryRank.units += item.quantity;
      categoryRank.revenueCents += value;
      byCategory.set(category, categoryRank);
    }
    byDay.set(day, point);
  }

  // Série diária sem buracos: dias sem venda aparecem com zero.
  const daily: DayPoint[] = [];
  const firstDay = start ?? (byDay.size > 0 ? new Date(`${[...byDay.keys()].sort()[0]}T00:00:00`) : null);
  if (firstDay) {
    const cursor = startOfDay(firstDay);
    const last = startOfDay(now);
    while (cursor <= last) {
      const key = dateKey(cursor);
      daily.push(byDay.get(key) ?? { date: key, revenueCents: 0, units: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const ranking = <T extends { units: number; revenueCents: number }>(list: T[], label: (item: T) => string) =>
    list.sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents || label(a).localeCompare(label(b), 'pt-BR'));

  return {
    revenueCents,
    commissionCents,
    netCents: revenueCents - commissionCents,
    unitsSold,
    ordersCompleted: sold.length,
    avgTicketCents: sold.length > 0 ? Math.round(revenueCents / sold.length) : 0,
    openReservations,
    notCompleted,
    topProducts: ranking([...byProduct.values()], (item) => item.name),
    byCategory: ranking([...byCategory.values()], (item) => item.category),
    daily,
  };
}
