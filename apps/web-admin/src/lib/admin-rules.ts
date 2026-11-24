/**
 * Cálculos do painel do administrador (todas as empresas juntas). Funções puras, sem rede, para poder testar.
 *
 * VENDA = reserva com status `picked_up` (retirada ou entregue). Volume vendido (GMV) = soma de quantidade × preço
 * unitário dos itens dessas reservas; é dinheiro das lojas. RECEITA DA PLATAFORMA = soma de commission_cents, a comissão
 * do FireStock gravada em cada venda quando a loja confirmou. "Itens salvos" = unidades vendidas (produtos que não viraram desperdício).
 * ATENÇÃO: o banco não guarda peso/unidade dos produtos, então não há como calcular "kg salvos" (RF018 do PRD).
 * USUÁRIO ATIVO = consumidor com pelo menos uma reserva (de qualquer status) no período.
 */

export type SaleStatus = 'pending' | 'confirmed' | 'picked_up' | 'cancelled' | 'expired' | 'no_show';

export type SaleItem = { product_id: string; quantity: number; unit_price_cents: number };

export type SaleOrder = {
  id: string;
  consumer_id: string;
  partner_id: string;
  status: SaleStatus;
  created_at: string;
  picked_up_at: string | null;
  /** Comissão do FireStock gravada na venda (null em pedidos ainda não concluídos). */
  commission_cents?: number | null;
  items: SaleItem[];
};

export type ProductRef = { id: string; name: string; category_id: string | null; partner_id: string };
export type PartnerStatus = 'pending' | 'approved' | 'rejected';
export type PartnerRef = { id: string; trade_name: string; status: PartnerStatus; category: string | null; created_at: string };
export type CategoryRef = { id: string; name: string };

export type Period = 7 | 30 | 90 | 'all';

export const PERIOD_LABEL: Record<string, string> = {
  '7': 'Últimos 7 dias',
  '30': 'Últimos 30 dias',
  '90': 'Últimos 90 dias',
  all: 'Todo o período',
};

export const STATUS_LABEL: Record<SaleStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  picked_up: 'Concluída',
  cancelled: 'Cancelada',
  expired: 'Vencida',
  no_show: 'Não retirada',
};

export const STATUS_ORDER: SaleStatus[] = ['picked_up', 'confirmed', 'pending', 'cancelled', 'expired', 'no_show'];

export const NO_CATEGORY = 'Sem categoria';
export const REMOVED_PRODUCT = 'Produto removido';
export const UNKNOWN_PARTNER = 'Empresa desconhecida';

export type ProductRank = { productId: string; name: string; category: string; partnerName: string; units: number; revenueCents: number };
export type CategoryRank = { category: string; units: number; revenueCents: number };
export type PartnerRank = { partnerId: string; name: string; units: number; revenueCents: number; orders: number; commissionCents: number };
export type StatusCount = { status: SaleStatus; label: string; count: number };
export type DayPoint = { date: string; revenueCents: number; units: number; commissionCents: number };

export type AdminData = {
  /** Volume vendido (GMV): valor dos produtos vendidos por todas as lojas. */
  revenueCents: number;
  /** Receita da plataforma: comissões do FireStock sobre essas vendas. */
  platformRevenueCents: number;
  unitsSold: number;
  ordersCompleted: number;
  avgTicketCents: number;
  /** Reservas feitas (ou retiradas) no período, de qualquer status. */
  ordersInPeriod: number;
  /** Consumidores diferentes com reserva no período. */
  activeUsers: number;
  byStatus: StatusCount[];
  topProducts: ProductRank[];
  byCategory: CategoryRank[];
  byPartner: PartnerRank[];
  daily: DayPoint[];
  /** Situação do cadastro das empresas (não depende do período). */
  partnerCounts: Record<PartnerStatus, number>;
  pendingPartners: PartnerRef[];
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** "2026-11-17" no fuso do navegador (é o dia que o administrador enxerga). */
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

/** Data em que a reserva conta: a da retirada (se foi retirada); senão, a da reserva. */
function activityDate(order: SaleOrder): Date {
  return new Date(order.status === 'picked_up' ? (order.picked_up_at ?? order.created_at) : order.created_at);
}

export function summarizeAdmin(
  orders: SaleOrder[],
  products: ProductRef[],
  partners: PartnerRef[],
  categories: CategoryRef[],
  period: Period,
  now: Date = new Date(),
): AdminData {
  const start = periodStart(period, now);
  const productById = new Map(products.map((product) => [product.id, product]));
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  const inPeriod = orders.filter((order) => {
    const when = activityDate(order);
    return (start === null || when >= start) && when <= now;
  });
  const sold = inPeriod.filter((order) => order.status === 'picked_up');

  const statusCount = new Map<SaleStatus, number>();
  for (const order of inPeriod) statusCount.set(order.status, (statusCount.get(order.status) ?? 0) + 1);

  const byProduct = new Map<string, ProductRank>();
  const byCategory = new Map<string, CategoryRank>();
  const byPartner = new Map<string, PartnerRank>();
  const byDay = new Map<string, DayPoint>();
  let revenueCents = 0;
  let unitsSold = 0;
  let platformRevenueCents = 0;

  for (const order of sold) {
    const day = dateKey(activityDate(order));
    const point = byDay.get(day) ?? { date: day, revenueCents: 0, units: 0, commissionCents: 0 };
    const partnerName = partnerById.get(order.partner_id)?.trade_name ?? UNKNOWN_PARTNER;
    const partnerRank = byPartner.get(order.partner_id) ?? {
      partnerId: order.partner_id,
      name: partnerName,
      units: 0,
      revenueCents: 0,
      orders: 0,
      commissionCents: 0,
    };
    const commission = order.commission_cents ?? 0;
    partnerRank.orders += 1;
    partnerRank.commissionCents += commission;
    point.commissionCents += commission;
    platformRevenueCents += commission;

    for (const item of order.items) {
      const value = item.quantity * item.unit_price_cents;
      const product = productById.get(item.product_id);
      const category = (product?.category_id && categoryName.get(product.category_id)) || NO_CATEGORY;

      revenueCents += value;
      unitsSold += item.quantity;
      point.revenueCents += value;
      point.units += item.quantity;
      partnerRank.units += item.quantity;
      partnerRank.revenueCents += value;

      const rank = byProduct.get(item.product_id) ?? {
        productId: item.product_id,
        name: product?.name ?? REMOVED_PRODUCT,
        category,
        partnerName: partnerById.get(product?.partner_id ?? order.partner_id)?.trade_name ?? partnerName,
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
    byPartner.set(order.partner_id, partnerRank);
  }

  // Série diária sem buracos: dias sem venda aparecem com zero.
  const daily: DayPoint[] = [];
  const firstDay = start ?? (byDay.size > 0 ? new Date(`${[...byDay.keys()].sort()[0]}T00:00:00`) : null);
  if (firstDay) {
    const cursor = startOfDay(firstDay);
    const last = startOfDay(now);
    while (cursor <= last) {
      const key = dateKey(cursor);
      daily.push(byDay.get(key) ?? { date: key, revenueCents: 0, units: 0, commissionCents: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const ranking = <T extends { units: number; revenueCents: number }>(list: T[], label: (item: T) => string) =>
    list.sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents || label(a).localeCompare(label(b), 'pt-BR'));

  const partnerCounts: Record<PartnerStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const partner of partners) partnerCounts[partner.status] += 1;

  return {
    revenueCents,
    platformRevenueCents,
    unitsSold,
    ordersCompleted: sold.length,
    avgTicketCents: sold.length > 0 ? Math.round(revenueCents / sold.length) : 0,
    ordersInPeriod: inPeriod.length,
    activeUsers: new Set(inPeriod.map((order) => order.consumer_id)).size,
    byStatus: STATUS_ORDER.map((status) => ({ status, label: STATUS_LABEL[status], count: statusCount.get(status) ?? 0 })),
    topProducts: ranking([...byProduct.values()], (item) => item.name),
    byCategory: ranking([...byCategory.values()], (item) => item.category),
    byPartner: ranking([...byPartner.values()], (item) => item.name),
    daily,
    partnerCounts,
    pendingPartners: partners.filter((partner) => partner.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}
