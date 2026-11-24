import { PARTNERS, type Partner } from '@/data/partners';
import { seededFraction } from '@/utils/seeded';

export type PriceComparison = {
  market: Partner;
  price: number;
  difference: number;
};

/** Compares a product's price against other partner markets. Prices are derived deterministically from the product+market pair (no backend price feed yet), always above the product's own price, so "melhor preço aqui" holds. */
export function getPriceComparisons(productId: string, ownMarketId: string, ownPrice: number, limit = 2): PriceComparison[] {
  return PARTNERS.filter((partner) => partner.kind === 'mercado' && partner.id !== ownMarketId)
    .slice(0, limit)
    .map((market) => {
      const fraction = seededFraction(`${productId}-${market.id}`);
      const price = ownPrice * (1 + 0.08 + fraction * 0.3);
      return {
        market,
        price,
        difference: price - ownPrice,
      };
    });
}
