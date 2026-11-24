import { useState } from 'react';

import { CrossMarketModal } from '@/components/cart/cross-market-modal';
import { useCart, type CartItem } from '@/contexts/cart-context';
import { getPartner } from '@/data/partners';
import { getProduct } from '@/data/products';
import { useCartSummary } from '@/hooks/use-cart-summary';

type PendingAddition = { marketId: string; lines: CartItem[]; description: string };

/** Wraps the cart's add actions with the "single market per order" rule: adding products from a
 * different market than what's already in the cart asks the shopper to clear the cart first, instead
 * of silently mixing markets in one order. Render the returned `modal` once in the screen. */
export function useGuardedAddToCart() {
  const { addItems, clearCart } = useCart();
  const { market: currentMarket, itemCount, subtotal } = useCartSummary();
  const [pending, setPending] = useState<PendingAddition | null>(null);

  /** Returns true when the lines went straight into the cart, false when the shopper must confirm. */
  const addLinesToCart = (lines: CartItem[], description: string): boolean => {
    const firstProduct = getProduct(lines[0]?.id);
    if (!firstProduct) return false;
    if (currentMarket && currentMarket.id !== firstProduct.marketId) {
      setPending({ marketId: firstProduct.marketId, lines, description });
      return false;
    }
    addItems(lines);
    return true;
  };

  const addToCart = (productId: string, quantity = 1): boolean => {
    const product = getProduct(productId);
    if (!product) return false;
    return addLinesToCart([{ id: productId, quantity }], product.title);
  };

  const handleKeep = () => setPending(null);

  const handleReplace = () => {
    if (!pending) return;
    clearCart();
    addItems(pending.lines);
    setPending(null);
  };

  const incomingMarket = pending ? getPartner(pending.marketId) : undefined;
  const incomingCount = pending ? pending.lines.reduce((sum, line) => sum + line.quantity, 0) : 0;
  const incomingTotal = pending
    ? pending.lines.reduce((sum, line) => sum + (getProduct(line.id)?.price ?? 0) * line.quantity, 0)
    : 0;

  const modal =
    pending && currentMarket && incomingMarket ? (
      <CrossMarketModal
        currentMarket={currentMarket}
        currentItemCount={itemCount}
        currentTotal={subtotal}
        incomingMarket={incomingMarket}
        incomingDescription={pending.description}
        incomingItemCount={incomingCount}
        incomingTotal={incomingTotal}
        onKeep={handleKeep}
        onReplace={handleReplace}
      />
    ) : null;

  return { addToCart, addLinesToCart, modal };
}
