import { useCart } from '@/contexts/cart-context';
import { getPartner, type Partner } from '@/data/partners';
import { getProduct, type Product } from '@/data/products';
import { useCatalogVersion } from '@/contexts/catalog-context';

export type CartLine = { product: Product; quantity: number };

/** Everything derived from the cart that more than one screen needs: resolved product lines, the
 * (single) market the order goes to, and the money math. Keeping it here means the cart, checkout and
 * cross-market guard can never disagree on a subtotal. */
export function useCartSummary() {
  useCatalogVersion();
  const { items, appliedCoupon } = useCart();

  const lines: CartLine[] = [];
  for (const item of items) {
    const product = getProduct(item.id);
    if (product) lines.push({ product, quantity: item.quantity });
  }

  const market: Partner | undefined = lines.length > 0 ? getPartner(lines[0].product.marketId) : undefined;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const discount = appliedCoupon ? Math.min(appliedCoupon.discount, subtotal) : 0;

  return { lines, market, itemCount, subtotal, discount, appliedCoupon };
}
