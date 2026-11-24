import type { PartnerStatus } from '../lib/admin-rules';
import type { PartnerDetail } from '../lib/partner-rules';
import { supabase } from '../lib/supabase';

/**
 * Empresas para aprovar / recusar. A leitura de todas as empresas vem da regra de acesso (RLS) de admin;
 * a decisão passa pela função public.review_partner (supabase/migrations/admin_partner_review.sql), que confere de novo
 * se quem chama é admin e grava as colunas certas.
 */

const COLUMNS =
  'id, legal_name, trade_name, cnpj, category, phone, email, cep, street, number, complement, neighborhood, city, state, status, rejection_reason, approved_at, created_at, logo_url';

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

export async function listPartnerDetails(): Promise<PartnerDetail[]> {
  const rows: PartnerDetail[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('partners')
      .select(COLUMNS)
      .order('created_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('Não foi possível carregar as empresas.');
    const chunk = (data ?? []) as PartnerDetail[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Aprova (approve = true) ou recusa com motivo. Devolve a nova situação. */
export async function reviewPartner(partnerId: string, approve: boolean, reason?: string): Promise<PartnerStatus> {
  const { data, error } = await supabase.rpc('review_partner', {
    p_partner_id: partnerId,
    p_approve: approve,
    p_reason: approve ? null : (reason ?? '').trim(),
  });
  if (error) {
    // PGRST202 = a função não existe no banco: a migração ainda não foi aplicada.
    if (error.code === 'PGRST202') throw new Error('Falta rodar supabase/migrations/admin_partner_review.sql no Supabase.');
    throw new Error(error.code === 'P0001' && error.message ? error.message : 'Não foi possível salvar a decisão. Tente novamente.');
  }
  return data as PartnerStatus;
}
