/** Regras da tela de comissões. Funções puras, sem rede, para poder testar (o banco confere de novo). */

export const COMMISSION_MAX = 50;

/** "10", "4,5", "4.5%" -> número; null se vazio, texto, negativo, acima do máximo ou com mais de 2 casas. */
export function parsePercent(input: string): number | null {
  const text = input.replace('%', '').trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  return value >= 0 && value <= COMMISSION_MAX ? value : null;
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** Exemplo para o admin entender o efeito da taxa: comissão sobre uma venda de R$ 100,00. */
export function commissionOn(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}
