import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useProfile } from '@/contexts/profile-context';

export type CartItem = {
  id: string;
  quantity: number;
};

export type Coupon = { code: string; discount: number; label: string };

const AVAILABLE_COUPONS: Coupon[] = [{ code: 'FRESCO5', discount: 5, label: 'R$ 5,00 de desconto' }];

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  quantityOf: (id: string) => number;
  addItem: (id: string, quantity?: number) => void;
  /** Adds several lines at once (e.g. "Pedir de novo"), merging with what's already in the cart. */
  addItems: (lines: CartItem[]) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function mergeLines(current: CartItem[], additions: CartItem[]): CartItem[] {
  const next = current.map((item) => ({ ...item }));
  for (const addition of additions) {
    if (addition.quantity <= 0) continue;
    const existing = next.find((item) => item.id === addition.id);
    if (existing) {
      existing.quantity += addition.quantity;
    } else {
      next.push({ id: addition.id, quantity: addition.quantity });
    }
  }
  return next;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { userId } = useProfile();
  const [items, setItems] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  // Cart never persisted across app restarts anyway, but nothing cleared it on a same-session account
  // switch either — a second person signing in on the same device would see the previous shopper's cart.
  // Any change of who's signed in (including signing out, userId -> '') starts fresh.
  useEffect(() => {
    setItems([]);
    setAppliedCoupon(null);
  }, [userId]);

  const addItems = (lines: CartItem[]) => setItems((current) => mergeLines(current, lines));

  const addItem = (id: string, quantity = 1) => addItems([{ id, quantity }]);

  const removeItem = (id: string) => {
    setItems((current) =>
      current.flatMap((item) => {
        if (item.id !== id) return [item];
        if (item.quantity <= 1) return [];
        return [{ ...item, quantity: item.quantity - 1 }];
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const applyCoupon = (code: string) => {
    const found = AVAILABLE_COUPONS.find((coupon) => coupon.code === code.trim().toUpperCase());
    setAppliedCoupon(found ?? null);
    return Boolean(found);
  };

  const removeCoupon = () => setAppliedCoupon(null);

  const quantityOf = (id: string) => items.find((item) => item.id === id)?.quantity ?? 0;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // No manual useMemo/useCallback: the React Compiler (app.json → experiments.reactCompiler) memoizes
  // this value and these handlers from their real dependencies.
  const value: CartContextValue = {
    items,
    totalItems,
    quantityOf,
    addItem,
    addItems,
    removeItem,
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
