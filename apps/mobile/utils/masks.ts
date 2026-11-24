/** Input masks for Brazilian formats. Each takes raw keyboard input and returns the formatted value. */

const digitsOf = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

/** (45) 99999-9999 or (45) 3333-4444 */
export function maskPhone(value: string): string {
  const digits = digitsOf(value, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  const area = digits.slice(0, 2);
  const rest = digits.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  if (rest.length <= split) return `(${area}) ${rest}`;
  return `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** 000.000.000-00 */
export function maskCpf(value: string): string {
  const digits = digitsOf(value, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** 00000-000 */
export function maskCep(value: string): string {
  const digits = digitsOf(value, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/** DD/MM/AAAA */
export function maskDate(value: string): string {
  const digits = digitsOf(value, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** 0000 0000 0000 0000 */
export function maskCardNumber(value: string): string {
  return digitsOf(value, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

/** MM/AA */
export function maskExpiry(value: string): string {
  const digits = digitsOf(value, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
