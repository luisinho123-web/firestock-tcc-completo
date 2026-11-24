import { isValidCnpj, onlyDigits } from './cnpj';

export type CompanyForm = {
  legalName: string; tradeName: string; cnpj: string; phone: string; email: string; category: string;
  cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string;
};

export type CompanyErrors = Partial<Record<keyof CompanyForm, string>>;

export const COMPANY_CATEGORIES = ['Supermercado', 'Mercado', 'Padaria', 'Hortifruti', 'Açougue', 'Restaurante', 'Conveniência', 'Outros'];

/**
 * Valida os dados da empresa (cadastro e configurações). `identityLocked`: depois de aprovada, razão social e CNPJ só o
 * administrador altera (o banco recusa), então não são cobrados aqui.
 */
export function validateCompany(form: CompanyForm, options: { identityLocked?: boolean } = {}): CompanyErrors {
  const errors: CompanyErrors = {};
  if (!options.identityLocked) {
    if (!form.legalName.trim()) errors.legalName = 'Informe a razão social.';
    if (!isValidCnpj(form.cnpj)) errors.cnpj = 'Digite um CNPJ válido.';
  }
  if (!form.tradeName.trim()) errors.tradeName = 'Informe o nome fantasia.';
  if (onlyDigits(form.phone).length < 10) errors.phone = 'Informe um telefone com DDD.';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Digite um e-mail válido.';
  if (!form.category) errors.category = 'Escolha a categoria.';
  if (onlyDigits(form.cep).length !== 8) errors.cep = 'Informe o CEP.';
  if (!form.street.trim()) errors.street = 'Informe a rua.';
  if (!form.number.trim()) errors.number = 'Informe o número.';
  if (!form.neighborhood.trim()) errors.neighborhood = 'Informe o bairro.';
  if (!form.city.trim()) errors.city = 'Informe a cidade.';
  if (!/^[A-Za-z]{2}$/.test(form.state.trim())) errors.state = 'Use a sigla do estado (ex.: PR).';
  return errors;
}
