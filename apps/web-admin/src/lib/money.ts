/** Centavos → "R$ 1.234,56". */
export function formatCents(cents: number): string {
  const reais = Math.floor(cents / 100).toLocaleString('pt-BR');
  return `R$ ${reais},${String(cents % 100).padStart(2, '0')}`;
}
