/**
 * Regras da tela de empresas (aprovar / recusar). Funções puras, sem rede, para poder testar.
 * As mesmas regras são conferidas de novo no banco, em public.review_partner.
 */

import type { PartnerStatus } from './admin-rules';

export type PartnerDetail = {
  id: string;
  legal_name: string;
  trade_name: string;
  cnpj: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: PartnerStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
  logo_url: string | null;
};

export type StatusFilter = PartnerStatus | 'all';

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  pending: 'Aguardando aprovação',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

export const REJECTION_REASON_MAX = 500;

const onlyDigits = (value: string) => value.replace(/\D/g, '');

/** 12345678000190 -> 12.345.678/0001-90 (devolve como veio se não tiver 14 dígitos). */
export function formatCnpj(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** 45999998888 -> (45) 99999-8888; 4533334444 -> (45) 3333-4444. */
export function formatPhone(value: string | null): string {
  if (!value) return '—';
  const d = onlyDigits(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

/** "Rua X, 10 (sala 2) · Centro · Cascavel/PR · CEP 85800-000", sem partes vazias. */
export function formatAddress(partner: Pick<PartnerDetail, 'street' | 'number' | 'complement' | 'neighborhood' | 'city' | 'state' | 'cep'>): string {
  const street = [partner.street, partner.number].filter(Boolean).join(', ');
  const line = partner.complement ? `${street} (${partner.complement})` : street;
  const place = [partner.city, partner.state].filter(Boolean).join('/');
  const cep = partner.cep ? onlyDigits(partner.cep) : '';
  const cepText = cep.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : cep ? `CEP ${partner.cep}` : '';
  return [line, partner.neighborhood, place, cepText].filter(Boolean).join(' · ') || '—';
}

/** Mensagem de erro do motivo de recusa, ou null se estiver bom. */
export function rejectionReasonError(reason: string): string | null {
  const text = reason.trim();
  if (!text) return 'Informe o motivo da recusa. A empresa vai ver esse texto.';
  if (text.length > REJECTION_REASON_MAX) return `O motivo pode ter no máximo ${REJECTION_REASON_MAX} caracteres.`;
  return null;
}

export function canApprove(status: PartnerStatus): boolean {
  return status === 'pending' || status === 'rejected';
}

export function canReject(status: PartnerStatus): boolean {
  return status === 'pending';
}

/** Filtra por situação e por texto (nome fantasia, razão social, CNPJ com ou sem máscara, cidade ou e-mail). */
export function filterPartners(partners: PartnerDetail[], status: StatusFilter, search: string): PartnerDetail[] {
  const term = search.trim().toLowerCase();
  const digits = onlyDigits(term);
  return partners.filter((partner) => {
    if (status !== 'all' && partner.status !== status) return false;
    if (!term) return true;
    const text = [partner.trade_name, partner.legal_name, partner.city, partner.email].filter(Boolean).join(' ').toLowerCase();
    return text.includes(term) || (digits.length >= 3 && partner.cnpj.includes(digits));
  });
}

/** Pendentes primeiro (do mais antigo, que espera há mais tempo); depois o resto, do mais novo para o mais antigo. */
export function sortPartners(partners: PartnerDetail[]): PartnerDetail[] {
  return [...partners].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    if (a.status === 'pending') return a.created_at.localeCompare(b.created_at);
    return b.created_at.localeCompare(a.created_at);
  });
}

export function countByStatus(partners: PartnerDetail[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: partners.length, pending: 0, approved: 0, rejected: 0 };
  for (const partner of partners) counts[partner.status] += 1;
  return counts;
}
