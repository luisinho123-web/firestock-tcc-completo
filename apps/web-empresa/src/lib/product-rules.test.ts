import { describe, expect, it } from 'vitest';

import { expiryToIso, productState, validateProduct, type ProductForm } from './product-rules';

const NOW = new Date('2026-10-19T12:00:00-03:00');

const valid: ProductForm = {
  name: 'Iogurte natural 170g',
  categoryId: 'cat-1',
  description: 'Lote com validade próxima.',
  expiresOn: '2026-10-25',
  quantity: '12',
  originalPrice: '5,90',
  discountPercent: '40',
  barcode: '',
};

describe('validateProduct', () => {
  it('aceita um produto válido', () => {
    expect(validateProduct(valid, NOW)).toEqual({});
  });

  it('exige nome e categoria', () => {
    const errors = validateProduct({ ...valid, name: '  ', categoryId: '' }, NOW);
    expect(errors.name).toBeDefined();
    expect(errors.categoryId).toBeDefined();
  });

  it('recusa desconto fora de 20–90', () => {
    expect(validateProduct({ ...valid, discountPercent: '19' }, NOW).discountPercent).toBeDefined();
    expect(validateProduct({ ...valid, discountPercent: '91' }, NOW).discountPercent).toBeDefined();
    expect(validateProduct({ ...valid, discountPercent: '20' }, NOW).discountPercent).toBeUndefined();
    expect(validateProduct({ ...valid, discountPercent: '90' }, NOW).discountPercent).toBeUndefined();
    expect(validateProduct({ ...valid, discountPercent: '25,5' }, NOW).discountPercent).toBeDefined();
  });

  it('recusa validade vazia ou passada e aceita o fim de hoje', () => {
    expect(validateProduct({ ...valid, expiresOn: '' }, NOW).expiresOn).toBeDefined();
    expect(validateProduct({ ...valid, expiresOn: '2026-10-18' }, NOW).expiresOn).toBeDefined();
    expect(validateProduct({ ...valid, expiresOn: '2026-10-19' }, NOW).expiresOn).toBeUndefined();
  });

  it('recusa quantidade negativa, decimal ou vazia', () => {
    expect(validateProduct({ ...valid, quantity: '-1' }, NOW).quantity).toBeDefined();
    expect(validateProduct({ ...valid, quantity: '1,5' }, NOW).quantity).toBeDefined();
    expect(validateProduct({ ...valid, quantity: '' }, NOW).quantity).toBeDefined();
    expect(validateProduct({ ...valid, quantity: '0' }, NOW).quantity).toBeUndefined();
  });

  it('recusa preço inválido', () => {
    expect(validateProduct({ ...valid, originalPrice: '0' }, NOW).originalPrice).toBeDefined();
  });

  it('recusa medicamentos e suplementos (RN010), mesmo com acento ou caixa diferente', () => {
    expect(validateProduct({ ...valid, name: 'Suplemento de vitamina C' }, NOW).name).toBeDefined();
    expect(validateProduct({ ...valid, description: 'REMÉDIO para dor' }, NOW).description).toBeDefined();
  });

  it('código de barras, se informado, só com 8 a 14 dígitos', () => {
    expect(validateProduct({ ...valid, barcode: '123' }, NOW).barcode).toBeDefined();
    expect(validateProduct({ ...valid, barcode: '7891234567895' }, NOW).barcode).toBeUndefined();
  });
});

describe('expiryToIso', () => {
  it('trata a validade como o fim do dia no horário local', () => {
    const iso = expiryToIso('2026-10-25');
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(23);
  });
});

describe('productState', () => {
  const base = { status: 'active' as const, quantity: 5, expires_at: '2026-10-25T23:59:59-03:00' };

  it('ativo, esgotado, vencido e removido', () => {
    expect(productState(base, NOW)).toBe('active');
    expect(productState({ ...base, quantity: 0 }, NOW)).toBe('soldout');
    expect(productState({ ...base, expires_at: '2026-10-10T23:59:59-03:00' }, NOW)).toBe('expired');
    expect(productState({ ...base, status: 'expired' }, NOW)).toBe('expired');
    expect(productState({ ...base, status: 'removed' }, NOW)).toBe('removed');
  });
});
