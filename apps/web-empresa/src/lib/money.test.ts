import { describe, expect, it } from 'vitest';

import { finalPriceCents, formatCents, parsePriceToCents } from './money';

describe('money', () => {
  it('converte preço digitado para centavos sem erro de arredondamento', () => {
    expect(parsePriceToCents('12,90')).toBe(1290);
    expect(parsePriceToCents('12.9')).toBe(1290);
    expect(parsePriceToCents('R$ 1.234,56')).toBe(123456);
    expect(parsePriceToCents('1.234')).toBe(123400);
    expect(parsePriceToCents('0,29')).toBe(29);
    expect(parsePriceToCents('19,99')).toBe(1999);
  });

  it('recusa preço vazio, zero, negativo, texto ou com mais de 2 casas', () => {
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('0')).toBeNull();
    expect(parsePriceToCents('-5')).toBeNull();
    expect(parsePriceToCents('abc')).toBeNull();
    expect(parsePriceToCents('12,999')).toBeNull();
  });

  it('calcula o preço final como o banco (divisão inteira)', () => {
    expect(finalPriceCents(1000, 30)).toBe(700);
    expect(finalPriceCents(1099, 30)).toBe(769);
  });

  it('formata em reais', () => {
    expect(formatCents(1290)).toBe('R$ 12,90');
    expect(formatCents(5)).toBe('R$ 0,05');
    expect(formatCents(123456)).toBe('R$ 1.234,56');
  });
});
