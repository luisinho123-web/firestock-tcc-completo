import { describe, expect, it } from 'vitest';

import {
  canApprove,
  canReject,
  countByStatus,
  filterPartners,
  formatAddress,
  formatCnpj,
  formatPhone,
  rejectionReasonError,
  sortPartners,
  type PartnerDetail,
} from './partner-rules';

const base: PartnerDetail = {
  id: 'p1',
  legal_name: 'Mercado Bom Preço LTDA',
  trade_name: 'Bom Preço',
  cnpj: '12345678000190',
  category: 'Mercado',
  phone: '45999998888',
  email: 'contato@bompreco.com',
  cep: '85800000',
  street: 'Rua Paraná',
  number: '100',
  complement: null,
  neighborhood: 'Centro',
  city: 'Cascavel',
  state: 'PR',
  status: 'pending',
  rejection_reason: null,
  approved_at: null,
  created_at: '2026-11-10T10:00:00Z',
  logo_url: null,
};

const partner = (patch: Partial<PartnerDetail>): PartnerDetail => ({ ...base, ...patch });

describe('formatação', () => {
  it('CNPJ com máscara', () => {
    expect(formatCnpj('12345678000190')).toBe('12.345.678/0001-90');
    expect(formatCnpj('123')).toBe('123');
  });

  it('telefone celular, fixo e vazio', () => {
    expect(formatPhone('45999998888')).toBe('(45) 99999-8888');
    expect(formatPhone('4533334444')).toBe('(45) 3333-4444');
    expect(formatPhone(null)).toBe('—');
  });

  it('endereço sem partes vazias', () => {
    expect(formatAddress(base)).toBe('Rua Paraná, 100 · Centro · Cascavel/PR · CEP 85800-000');
    expect(formatAddress({ ...base, complement: 'sala 2', neighborhood: null, cep: null })).toBe('Rua Paraná, 100 (sala 2) · Cascavel/PR');
    expect(formatAddress({ street: null, number: null, complement: null, neighborhood: null, city: null, state: null, cep: null })).toBe('—');
  });
});

describe('rejectionReasonError', () => {
  it('exige motivo', () => {
    expect(rejectionReasonError('')).not.toBeNull();
    expect(rejectionReasonError('   ')).not.toBeNull();
  });

  it('limita o tamanho', () => {
    expect(rejectionReasonError('a'.repeat(501))).not.toBeNull();
    expect(rejectionReasonError('a'.repeat(500))).toBeNull();
  });

  it('aceita motivo normal', () => {
    expect(rejectionReasonError('CNPJ não confere.')).toBeNull();
  });
});

describe('ações permitidas', () => {
  it('aprovar: pendente ou recusada', () => {
    expect(canApprove('pending')).toBe(true);
    expect(canApprove('rejected')).toBe(true);
    expect(canApprove('approved')).toBe(false);
  });

  it('recusar: só pendente', () => {
    expect(canReject('pending')).toBe(true);
    expect(canReject('rejected')).toBe(false);
    expect(canReject('approved')).toBe(false);
  });
});

describe('filterPartners', () => {
  const list = [
    partner({ id: 'a', status: 'pending' }),
    partner({ id: 'b', status: 'approved', trade_name: 'Padaria Sol', legal_name: 'Sol LTDA', cnpj: '99888777000166', city: 'Toledo', email: null }),
    partner({ id: 'c', status: 'rejected', trade_name: 'Hortifruti Verde', legal_name: 'Verde ME', cnpj: '11222333000144' }),
  ];

  it('por situação', () => {
    expect(filterPartners(list, 'pending', '').map((p) => p.id)).toEqual(['a']);
    expect(filterPartners(list, 'all', '').map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('por nome, cidade e CNPJ com máscara', () => {
    expect(filterPartners(list, 'all', 'padaria').map((p) => p.id)).toEqual(['b']);
    expect(filterPartners(list, 'all', 'toledo').map((p) => p.id)).toEqual(['b']);
    expect(filterPartners(list, 'all', '11.222.333').map((p) => p.id)).toEqual(['c']);
  });

  it('conta por situação', () => {
    expect(countByStatus(list)).toEqual({ all: 3, pending: 1, approved: 1, rejected: 1 });
  });
});

describe('sortPartners', () => {
  it('pendentes primeiro, do mais antigo; depois os outros, do mais novo', () => {
    const list = [
      partner({ id: 'old-approved', status: 'approved', created_at: '2026-01-01T00:00:00Z' }),
      partner({ id: 'new-pending', status: 'pending', created_at: '2026-11-15T00:00:00Z' }),
      partner({ id: 'new-approved', status: 'approved', created_at: '2026-11-01T00:00:00Z' }),
      partner({ id: 'old-pending', status: 'pending', created_at: '2026-11-01T00:00:00Z' }),
    ];
    expect(sortPartners(list).map((p) => p.id)).toEqual(['old-pending', 'new-pending', 'new-approved', 'old-approved']);
  });
});
