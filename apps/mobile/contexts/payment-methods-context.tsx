import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';

import { useProfile } from '@/contexts/profile-context';
import { errorMessage } from '@/services/auth';
import { paymentMethodsService } from '@/services/supabase';

export type CardBrand = 'visa' | 'mastercard';
export type CardKind = 'credito' | 'debito';

export type PaymentMethod =
  | { id: string; type: 'pix' }
  | { id: string; type: 'dinheiro' }
  | {
      id: string;
      type: 'cartao';
      brand: CardBrand;
      kind: CardKind;
      holderName: string;
      last4: string;
      expiry: string;
    };

export type CardInput = {
  brand: CardBrand;
  kind: CardKind;
  holderName: string;
  last4: string;
  expiry: string;
};

type PaymentMethodsContextValue = {
  methods: PaymentMethod[];
  selectedMethodId: string;
  selectedMethod: PaymentMethod | undefined;
  selectMethod: (id: string) => void;
  addCard: (input: CardInput) => Promise<void>;
  removeMethod: (id: string) => Promise<void>;
};

const PaymentMethodsContext = createContext<PaymentMethodsContextValue | null>(null);

// Pix and Dinheiro are real, universal payment types (not tied to a specific person), so every shopper
// gets them for free, always selectable — only cards are per-user data fetched from Supabase below.
const FIXED_METHODS: PaymentMethod[] = [
  { id: 'pm-pix', type: 'pix' },
  { id: 'pm-dinheiro', type: 'dinheiro' },
];

export function PaymentMethodsProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthenticated } = useProfile();
  const [cards, setCards] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState(FIXED_METHODS[0].id);

  // Loads (or clears) this shopper's saved cards whenever who's signed in changes — mirrors
  // contexts/addresses-context.tsx. Without this, a second person signing in on the same device would
  // see (and could pay with) the previous shopper's cards.
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setCards([]);
      setSelectedMethodId(FIXED_METHODS[0].id);
      return;
    }
    let active = true;
    paymentMethodsService.listMyCards(userId).then((list) => {
      if (!active) return;
      setCards(list.map((card): PaymentMethod => ({ ...card, type: 'cartao' })));
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, userId]);

  const methods: PaymentMethod[] = [...FIXED_METHODS, ...cards];

  const selectMethod = (id: string) => setSelectedMethodId(id);

  const addCard = async (input: CardInput) => {
    try {
      const card = await paymentMethodsService.addCard(userId, input);
      const method: PaymentMethod = { ...card, type: 'cartao' };
      setCards((current) => [...current, method]);
      setSelectedMethodId(method.id);
    } catch (error) {
      Alert.alert('Não foi possível salvar o cartão', errorMessage(error));
    }
  };

  const removeMethod = async (id: string) => {
    // Pix/Dinheiro have nothing to delete in the database — only ever reached here if a screen somehow
    // passes a fixed method's id, which none of them do today.
    if (!cards.some((card) => card.id === id)) return;
    try {
      await paymentMethodsService.removeCard(id);
      setCards((current) => current.filter((card) => card.id !== id));
      setSelectedMethodId((current) => (current === id ? FIXED_METHODS[0].id : current));
    } catch (error) {
      Alert.alert('Não foi possível remover o cartão', errorMessage(error));
    }
  };

  const selectedMethod = methods.find((item) => item.id === selectedMethodId);

  return (
    <PaymentMethodsContext.Provider value={{ methods, selectedMethodId, selectedMethod, selectMethod, addCard, removeMethod }}>
      {children}
    </PaymentMethodsContext.Provider>
  );
}

export function usePaymentMethods() {
  const context = useContext(PaymentMethodsContext);
  if (!context) {
    throw new Error('usePaymentMethods must be used within a PaymentMethodsProvider');
  }
  return context;
}
