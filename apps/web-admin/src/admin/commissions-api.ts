import { supabase } from '../lib/supabase';

/**
 * Comissão do FireStock (supabase/migrations/platform_commission.sql). Leitura direta das tabelas (o admin vê tudo pela
 * regra de acesso); escrita só pelas funções set_platform_commission / set_partner_commission, que conferem se é admin.
 * Mudar a taxa vale para as PRÓXIMAS vendas: cada venda guarda a taxa do momento em que foi concluída.
 */

function rpcFailure(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === 'PGRST202' || error.code === '42P01' || error.code === 'PGRST205') {
    return new Error('Falta rodar supabase/migrations/platform_commission.sql no Supabase.');
  }
  return new Error(error.code === 'P0001' && error.message ? error.message : fallback);
}

export async function getPlatformCommission(): Promise<number> {
  const { data, error } = await supabase.from('platform_settings').select('commission_percent').maybeSingle();
  if (error) throw rpcFailure(error, 'Não foi possível carregar a comissão.');
  if (!data) throw new Error('Falta rodar supabase/migrations/platform_commission.sql no Supabase.');
  return Number(data.commission_percent);
}

/** Taxas especiais por empresa: partner_id -> %. */
export async function listPartnerCommissions(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('partner_commissions').select('partner_id, commission_percent');
  if (error) throw rpcFailure(error, 'Não foi possível carregar as taxas das empresas.');
  return new Map((data ?? []).map((row: { partner_id: string; commission_percent: number | string }) => [row.partner_id, Number(row.commission_percent)]));
}

export async function setPlatformCommission(percent: number): Promise<void> {
  const { error } = await supabase.rpc('set_platform_commission', { p_percent: percent });
  if (error) throw rpcFailure(error, 'Não foi possível salvar a comissão.');
}

/** percent null = a empresa volta a usar a taxa padrão. */
export async function setPartnerCommission(partnerId: string, percent: number | null): Promise<void> {
  const { error } = await supabase.rpc('set_partner_commission', { p_partner_id: partnerId, p_percent: percent });
  if (error) throw rpcFailure(error, 'Não foi possível salvar a taxa da empresa.');
}
