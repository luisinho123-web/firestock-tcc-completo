import type { ProductRef, SaleOrder, SaleStatus } from '../lib/dashboard-rules';
import { supabase } from '../lib/supabase';

type ReservationRow = {
  id: string;
  status: SaleStatus;
  created_at: string;
  picked_up_at: string | null;
  commission_cents: number | null;
  reservation_items: { product_id: string; quantity: number; unit_price_cents: number }[] | null;
};

// O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas.
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/**
 * Reservas da empresa com seus itens. A regra de acesso (RLS) já limita ao dono da empresa
 * (reservations_select), então outra empresa nunca aparece aqui, mesmo que o id seja trocado.
 */
export async function listSales(partnerId: string): Promise<SaleOrder[]> {
  const orders: SaleOrder[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('reservations')
      .select('id, status, created_at, picked_up_at, commission_cents, reservation_items(product_id, quantity, unit_price_cents)')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('Não foi possível carregar as vendas. Tente novamente.');

    const rows = (data ?? []) as unknown as ReservationRow[];
    for (const row of rows) {
      orders.push({
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        picked_up_at: row.picked_up_at,
        commission_cents: row.commission_cents,
        items: row.reservation_items ?? [],
      });
    }
    if (rows.length < PAGE_SIZE) break;
  }

  return orders;
}

/**
 * Comissão que vale hoje para a empresa: a taxa especial dela (se o admin definiu) ou a taxa padrão do FireStock.
 * Vendas já concluídas guardam a taxa do momento da venda; isto é só para mostrar a taxa atual.
 */
export async function getCurrentCommission(partnerId: string): Promise<{ percent: number; special: boolean } | null> {
  const [special, platform] = await Promise.all([
    supabase.from('partner_commissions').select('commission_percent').eq('partner_id', partnerId).maybeSingle(),
    supabase.from('platform_settings').select('commission_percent').maybeSingle(),
  ]);
  if (special.data) return { percent: Number(special.data.commission_percent), special: true };
  if (platform.data) return { percent: Number(platform.data.commission_percent), special: false };
  return null; // migração da comissão ainda não aplicada
}

/** Nome e categoria de TODOS os produtos da empresa (inclusive removidos, que ainda têm vendas no histórico). */
export async function listProductRefs(partnerId: string): Promise<ProductRef[]> {
  const { data, error } = await supabase.from('products').select('id, name, category_id').eq('partner_id', partnerId);
  if (error) throw new Error('Não foi possível carregar os produtos.');
  return data as ProductRef[];
}
