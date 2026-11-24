/**
 * Limpeza de texto digitado. Cada função recebe o que o teclado entregou e devolve o valor aceito.
 * Não usam trim() no fim: quem digita precisa conseguir escrever o espaço entre duas palavras.
 *
 * ATENÇÃO: este arquivo foi RECRIADO (o original não veio no pacote do projeto). Os limites abaixo são
 * escolhas razoáveis; confira se batem com o app publicado.
 */

export const INPUT_LIMITS = {
  name: 60,
  email: 254,
  password: 72,
  search: 60,
  coupon: 20,
  street: 80,
  addressNumber: 10,
  complement: 40,
  neighborhood: 50,
  city: 50,
  addressLabel: 20,
} as const;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

function collapseSpaces(value: string): string {
  return value.replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
}

/** Busca: sem caracteres de controle nem espaços repetidos. */
export function sanitizeSearch(value: string): string {
  return collapseSpaces(value.replace(CONTROL_CHARS, '')).slice(0, INPUT_LIMITS.search);
}

/** Nome de pessoa: letras (com acento), espaço, apóstrofo e hífen. */
export function sanitizeName(value: string): string {
  return collapseSpaces(value.replace(/[^\p{L}\s'’-]/gu, '')).slice(0, INPUT_LIMITS.name);
}

/** Nome impresso no cartão: só letras e espaços. */
export function sanitizeCardHolder(value: string): string {
  return collapseSpaces(value.replace(/[^\p{L}\s]/gu, '')).slice(0, INPUT_LIMITS.name);
}

/** E-mail: sem espaços nem caracteres de controle. */
export function sanitizeEmail(value: string): string {
  return value.replace(/\s/g, '').replace(CONTROL_CHARS, '').slice(0, INPUT_LIMITS.email);
}

/** Senha: mantém tudo que o usuário digitou (inclusive espaços), só tira caracteres de controle. */
export function sanitizePassword(value: string): string {
  return value.replace(CONTROL_CHARS, '').slice(0, INPUT_LIMITS.password);
}

/** Só dígitos, com limite opcional (ex.: CVV de 3 ou 4). */
export function sanitizeDigits(value: string, max?: number): string {
  const digits = value.replace(/\D/g, '');
  return max === undefined ? digits : digits.slice(0, max);
}

/** Cupom: maiúsculas, números, hífen e sublinhado. */
export function sanitizeCoupon(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, INPUT_LIMITS.coupon);
}

/** Rua, complemento e bairro: letras, números, espaço e pontuação comum de endereço. */
export function sanitizeAddressText(value: string, max: number = INPUT_LIMITS.street): string {
  return collapseSpaces(value.replace(/[^\p{L}\d\s.,'’º°ª/-]/gu, '')).slice(0, max);
}

/** Número do endereço: letras, números, hífen e barra (123, 45-A, S/N). */
export function sanitizeAddressNumber(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^\p{L}\d/-]/gu, '')
    .slice(0, INPUT_LIMITS.addressNumber);
}

/** Cidade: letras, espaço, hífen e apóstrofo. */
export function sanitizeCity(value: string): string {
  return collapseSpaces(value.replace(/[^\p{L}\s'’-]/gu, '')).slice(0, INPUT_LIMITS.city);
}

/** Apelido do endereço ("Casa", "Trabalho"): letras, números e espaço. */
export function sanitizeLabel(value: string): string {
  return collapseSpaces(value.replace(/[^\p{L}\d\s]/gu, '')).slice(0, INPUT_LIMITS.addressLabel);
}
