import { describe, expect, it } from 'vitest';

import { formatCnpj, isValidCnpj, onlyDigits } from './cnpj';

describe('cnpj', () => {
  it('aceita CNPJ válido com ou sem máscara', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('recusa dígito verificador errado, tamanho errado, letras e dígitos repetidos', () => {
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('11.222.333/0001-8A')).toBe(false);
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });

  it('formata enquanto digita e limita a 14 dígitos', () => {
    expect(formatCnpj('11222333')).toBe('11.222.333');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatCnpj('112223330001819999')).toBe('11.222.333/0001-81');
  });

  it('onlyDigits remove tudo que não é número', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });
});
