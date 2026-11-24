/** "R$ 1.234,50" — formatted by hand so output is identical on Hermes, JSC and web (Intl coverage varies).
 * The space after "R$" is non-breaking so a line wrap never strands the symbol away from the amount. */
export function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  const [integer, cents] = Math.abs(value).toFixed(2).split('.');
  const withThousands = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$\u00A0${withThousands},${cents}`;
}
