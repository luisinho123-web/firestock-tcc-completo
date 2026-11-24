import { describe, expect, it } from 'vitest';

import { validateCompany, type CompanyForm } from './company-rules';

const valid: CompanyForm = {
  legalName: 'Mercado Boa Compra Ltda',
  tradeName: 'Boa Compra',
  cnpj: '11.222.333/0001-81',
  phone: '(45) 99999-0000',
  email: 'contato@boacompra.com.br',
  category: 'Mercado',
  cep: '85801-000',
  street: 'Avenida Brasil',
  number: '4520',
  complement: '',
  neighborhood: 'Centro',
  city: 'Cascavel',
  state: 'PR',
};

describe('validateCompany', () => {
  it('aceita um cadastro completo', () => {
    expect(validateCompany(valid)).toEqual({});
  });

  it('exige os campos obrigatórios', () => {
    const errors = validateCompany({ ...valid, legalName: ' ', tradeName: '', street: '', number: '', neighborhood: '', city: '' });
    for (const key of ['legalName', 'tradeName', 'street', 'number', 'neighborhood', 'city'] as const) expect(errors[key]).toBeDefined();
  });

  it('valida CNPJ, telefone com DDD, e-mail, categoria, CEP e UF', () => {
    const errors = validateCompany({ ...valid, cnpj: '11.111.111/1111-11', phone: '9999', email: 'sem-arroba', category: '', cep: '123', state: 'P' });
    for (const key of ['cnpj', 'phone', 'email', 'category', 'cep', 'state'] as const) expect(errors[key]).toBeDefined();
  });

  it('com identidade travada (empresa aprovada) não cobra razão social nem CNPJ', () => {
    const errors = validateCompany({ ...valid, legalName: '', cnpj: '' }, { identityLocked: true });
    expect(errors.legalName).toBeUndefined();
    expect(errors.cnpj).toBeUndefined();
    expect(validateCompany({ ...valid, tradeName: '' }, { identityLocked: true }).tradeName).toBeDefined();
  });
});
