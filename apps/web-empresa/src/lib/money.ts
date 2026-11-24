/** "12,90", "12.9", "R$ 1.234,56" → centavos; null se vazio, zero, negativo, texto ou mais de 2 casas. */
export function parsePriceToCents(input: string): number | null {
  let text = input.replace(/R\$|\s/g, '');
  if (!text) return null;
  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  return cents > 0 ? cents : null;
}

/** Mesma conta da coluna gerada `price_cents` do banco (divisão inteira). */
export function finalPriceCents(originalCents: number, discountPercent: number): number {
  return Math.floor((originalCents * (100 - discountPercent)) / 100);
}

export function formatCents(cents: number): string {
  const reais = Math.floor(cents / 100).toLocaleString('pt-BR');
  return `R$ ${reais},${String(cents % 100).padStart(2, '0')}`;
}
