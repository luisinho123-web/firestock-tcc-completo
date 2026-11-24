/**
 * Número de WhatsApp no formato guardado no banco (profiles.notify_phone): só dígitos, com 55 na frente.
 * Aceita o que a pessoa digita: "(45) 99999-8888", "45999998888", "+55 45 99999-8888".
 * Devolve null se não for um número brasileiro válido (DDD + celular de 9 dígitos começando com 9, ou fixo de 8).
 * A regra é a mesma da restrição profiles_notify_phone_check (supabase/migrations/notifications_delivery.sql).
 */
export function toWhatsAppNumber(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  // Com o 55 na frente o número tem 12 ou 13 dígitos; com 11 dígitos o "55" seria o DDD do Rio Grande do Sul.
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (!/^[1-9][0-9](9[0-9]{8}|[2-9][0-9]{7})$/.test(digits)) return null;
  return `55${digits}`;
}

/** "5545999998888" (banco) → "45999998888": só os dígitos nacionais, prontos para a máscara do campo (maskPhone). */
export function fromWhatsAppNumber(stored: string | null | undefined): string {
  if (!stored) return '';
  const digits = stored.replace(/\D/g, '');
  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
}
