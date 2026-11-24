import { describe, expect, it } from 'vitest';

import { commissionOn, formatPercent, parsePercent } from './commission-rules';

describe('parsePercent', () => {
  it('aceita inteiro, vírgula, ponto e símbolo de %', () => {
    expect(parsePercent('10')).toBe(10);
    expect(parsePercent('4,5')).toBe(4.5);
    expect(parsePercent('4.75')).toBe(4.75);
    expect(parsePercent(' 3% ')).toBe(3);
    expect(parsePercent('0')).toBe(0);
  });

  it('recusa vazio, texto, negativo, acima de 50 e mais de 2 casas', () => {
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('abc')).toBeNull();
    expect(parsePercent('-1')).toBeNull();
    expect(parsePercent('51')).toBeNull();
    expect(parsePercent('4,555')).toBeNull();
  });
});

describe('formatação e exemplo', () => {
  it('formata em português', () => {
    expect(formatPercent(10)).toBe('10%');
    expect(formatPercent(4.5)).toBe('4,5%');
  });

  it('comissão sobre um valor', () => {
    expect(commissionOn(10000, 10)).toBe(1000);
    expect(commissionOn(1999, 4.5)).toBe(90);
  });
});
