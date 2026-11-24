export const onlyDigits = (value: string) => value.replace(/\D/g, '');

/** Máscara 00.000.000/0000-00 aplicada enquanto a pessoa digita (no máximo 14 dígitos). */
export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `.${d.slice(2, 5)}`;
  if (d.length > 5) out += `.${d.slice(5, 8)}`;
  if (d.length > 8) out += `/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12, 14)}`;
  return out;
}

function checkDigit(digits: string, length: number): number {
  const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Só CNPJ numérico (o banco exige 14 dígitos), com os dois dígitos verificadores corretos. */
export function isValidCnpj(value: string): boolean {
  if (/[^\d./-\s]/.test(value)) return false;
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  return checkDigit(d, 12) === Number(d[12]) && checkDigit(d, 13) === Number(d[13]);
}
