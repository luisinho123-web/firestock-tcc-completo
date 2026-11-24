const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same rule the API applies (server/auth.js), so the client never accepts what the server rejects. */
export const MIN_PASSWORD_LENGTH = 6;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

/** Checks the two CPF verifier digits; rejects repeated-digit sequences like 111.111.111-11. */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const verifier = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return verifier(9) === Number(digits[9]) && verifier(10) === Number(digits[10]);
}

/** DD/MM/AAAA that exists on the calendar and isn't in the future. */
export function isValidBirthDate(value: string, now: Date = new Date()): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  const exists = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return exists && year >= 1900 && date <= now;
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

export function isValidCep(value: string): boolean {
  return value.replace(/\D/g, '').length === 8;
}

/** Luhn checksum — catches typos in card numbers before they reach a payment provider. */
export function isValidCardNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** MM/AA with a real month, not already expired. */
export function isValidCardExpiry(value: string, now: Date = new Date()): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  // Cards are valid through the last day of the printed month.
  return new Date(year, month, 1) > now;
}

/** Só letras (com acentos), espaços, apóstrofo e hífen; mínimo de 2 letras. */
export function isValidName(value: string): boolean {
  const name = value.trim();
  return name.replace(/[^\p{L}]/gu, '').length >= 2 && /^[\p{L}][\p{L}\s'’-]*$/u.test(name);
}

/** Número do endereço: letras e números, com hífen ou barra (123, 45-A, S/N). */
export function isValidAddressNumber(value: string): boolean {
  return /^[\p{L}\d][\p{L}\d\s/-]{0,9}$/u.test(value.trim());
}
