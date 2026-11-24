import type { CategoryRef, PartnerRef, ProductRef, SaleOrder, SaleStatus } from '../lib/admin-rules';
import { supabase } from '../lib/supabase';

/**
 * Tudo aqui lê o banco com a chave publishable do administrador logado. O que ele consegue ver vem das regras de acesso
 * (RLS) do Supabase, que liberam leitura de todas as empresas, reservas e perfis só para quem tem `profiles.role = 'admin'`
 * (função `private.is_admin()`). Para um usuário comum, estas consultas voltam vazias ou só com os dados dele.
 */

// O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas.
const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

type Page = PromiseLike<{ data: unknown; error: unknown }>;

async function fetchAll<T>(page: (from: number, to: number) => Page, failure: string): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const from = index * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(failure);
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

type ReservationRow = {
  id: string;
  consumer_id: string;
  partner_id: string;
  status: SaleStatus;
  created_at: string;
  picked_up_at: string | null;
  commission_cents: number | null;
  reservation_items: { product_id: string; quantity: number; unit_price_cents: number }[] | null;
};

/** Reservas (com itens) feitas ou retiradas a partir de `sinceIso`; sem data, todas. */
export async function listSales(sinceIso: string | null): Promise<SaleOrder[]> {
  const rows = await fetchAll<ReservationRow>((from, to) => {
    let query = supabase
      .from('reservations')
      .select('id, consumer_id, partner_id, status, created_at, picked_up_at, commission_cents, reservation_items(product_id, quantity, unit_price_cents)')
      .order('created_at', { ascending: false })
      .order('id');
    if (sinceIso) query = query.or(`created_at.gte.${sinceIso},picked_up_at.gte.${sinceIso}`);
    return query.range(from, to);
  }, 'Não foi possível carregar as reservas. Tente novamente.');

  return rows.map((row) => ({
    id: row.id,
    consumer_id: row.consumer_id,
    partner_id: row.partner_id,
    status: row.status,
    created_at: row.created_at,
    picked_up_at: row.picked_up_at,
    commission_cents: row.commission_cents,
    items: row.reservation_items ?? [],
  }));
}

/** Todos os produtos de todas as empresas (inclusive removidos, que ainda têm vendas no histórico). */
export function listProducts(): Promise<ProductRef[]> {
  return fetchAll<ProductRef>(
    (from, to) => supabase.from('products').select('id, name, category_id, partner_id').order('id').range(from, to),
    'Não foi possível carregar os produtos.',
  );
}

export function listPartners(): Promise<PartnerRef[]> {
  return fetchAll<PartnerRef>(
    (from, to) => supabase.from('partners').select('id, trade_name, status, category, created_at').order('created_at').order('id').range(from, to),
    'Não foi possível carregar as empresas.',
  );
}

export async function listCategories(): Promise<CategoryRef[]> {
  const { data, error } = await supabase.from('categories').select('id, name').order('name');
  if (error) throw new Error('Não foi possível carregar as categorias.');
  return data as CategoryRef[];
}

/** Consumidores cadastrados; com `sinceIso`, só os que se cadastraram a partir dessa data. */
export async function countConsumers(sinceIso: string | null): Promise<number> {
  let query = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'consumer');
  if (sinceIso) query = query.gte('created_at', sinceIso);
  const { count, error } = await query;
  if (error) throw new Error('Não foi possível contar os usuários.');
  return count ?? 0;
}

/** Reservas aguardando retirada agora (pendentes ou confirmadas), de qualquer data. */
export async function countOpenReservations(): Promise<number> {
  const { count, error } = await supabase.from('reservations').select('id', { count: 'exact', head: true }).in('status', ['pending', 'confirmed']);
  if (error) throw new Error('Não foi possível contar as reservas em aberto.');
  return count ?? 0;
}

/** Papel do usuário logado (a própria linha de `profiles` é sempre legível por ele). */
export async function getMyRole(userId: string): Promise<{ role: string; name: string } | null> {
  const { data, error } = await supabase.from('profiles').select('role, full_name').eq('id', userId).maybeSingle();
  if (error) throw new Error('Não foi possível verificar a sua permissão.');
  return data ? { role: String((data as { role: unknown }).role), name: String((data as { full_name: unknown }).full_name ?? '') } : null;
}
