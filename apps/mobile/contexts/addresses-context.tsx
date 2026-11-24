import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';

import { useProfile } from '@/contexts/profile-context';
import { errorMessage } from '@/services/auth';
import { addressesService } from '@/services/supabase';

export type AddressTag = 'casa' | 'trabalho' | 'outro';

/** Fallback coordinates (Cascavel - PR, Centro) for addresses created without a geocoder. */
export const CASCAVEL_CENTER = { lat: -24.9555, lng: -53.4552 };

export type Address = {
  id: string;
  label: string;
  tag: AddressTag;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  /** Real-world coordinates used to place this address on the order-tracking map. */
  lat: number;
  lng: number;
  isDefault: boolean;
};

export type AddressInput = Omit<Address, 'id' | 'isDefault'>;

type AddressesContextValue = {
  addresses: Address[];
  selectedAddressId: string;
  selectedAddress: Address | undefined;
  isLoadingAddresses: boolean;
  selectAddress: (id: string) => void;
  addAddress: (input: AddressInput, makeDefault?: boolean) => Promise<void>;
  updateAddress: (id: string, input: AddressInput, makeDefault?: boolean) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
};

const AddressesContext = createContext<AddressesContextValue | null>(null);

export function AddressesProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthenticated } = useProfile();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Loads (or clears) the address book whenever who's signed in changes — mirrors how
  // contexts/profile-context.tsx fetches the profile row after a sign-in.
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setAddresses([]);
      setSelectedAddressId('');
      return;
    }
    let active = true;
    setIsLoadingAddresses(true);
    addressesService.listMyAddresses(userId).then((list) => {
      if (!active) return;
      setAddresses(list);
      setSelectedAddressId((current) =>
        current && list.some((item) => item.id === current) ? current : (list.find((item) => item.isDefault) ?? list[0])?.id ?? '',
      );
      setIsLoadingAddresses(false);
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, userId]);

  const selectAddress = (id: string) => setSelectedAddressId(id);

  const addAddress = async (input: AddressInput, makeDefault = false) => {
    // The first address a shopper saves is their default, whatever the toggle says.
    const shouldBeDefault = makeDefault || addresses.length === 0;
    try {
      const created = await addressesService.createAddress(userId, input, shouldBeDefault);
      // setDefaultAddress also clears is_default on every other row of this user in the database —
      // createAddress alone only sets it on the new row, which would leave two "default" rows otherwise.
      if (shouldBeDefault) await addressesService.setDefaultAddress(userId, created.id);
      setAddresses((current) => [...(shouldBeDefault ? current.map((item) => ({ ...item, isDefault: false })) : current), created]);
      setSelectedAddressId(created.id);
    } catch (error) {
      Alert.alert('Não foi possível salvar o endereço', errorMessage(error));
    }
  };

  const updateAddress = async (id: string, input: AddressInput, makeDefault?: boolean) => {
    try {
      const updated = await addressesService.updateAddress(id, input);
      setAddresses((current) => current.map((item) => (item.id === id ? updated : item)));
      if (makeDefault) await setDefaultAddress(id);
    } catch (error) {
      Alert.alert('Não foi possível salvar o endereço', errorMessage(error));
    }
  };

  const removeAddress = async (id: string) => {
    try {
      const wasDefault = addresses.find((item) => item.id === id)?.isDefault ?? false;
      await addressesService.deleteAddress(id);
      const next = addresses.filter((item) => item.id !== id);
      setAddresses(next);
      if (selectedAddressId === id) {
        setSelectedAddressId((next.find((item) => item.isDefault) ?? next[0])?.id ?? '');
      }
      // Removing the default promotes the first remaining address, so there's always one to fall back to.
      if (wasDefault && next.length > 0) {
        await setDefaultAddress(next[0].id);
      }
    } catch (error) {
      Alert.alert('Não foi possível remover o endereço', errorMessage(error));
    }
  };

  const setDefaultAddress = async (id: string) => {
    try {
      await addressesService.setDefaultAddress(userId, id);
      setAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === id })));
    } catch (error) {
      Alert.alert('Não foi possível definir o endereço padrão', errorMessage(error));
    }
  };

  const selectedAddress = addresses.find((item) => item.id === selectedAddressId);

  return (
    <AddressesContext.Provider
      value={{
        addresses,
        selectedAddressId,
        selectedAddress,
        isLoadingAddresses,
        selectAddress,
        addAddress,
        updateAddress,
        removeAddress,
        setDefaultAddress,
      }}>
      {children}
    </AddressesContext.Provider>
  );
}

export function useAddresses() {
  const context = useContext(AddressesContext);
  if (!context) {
    throw new Error('useAddresses must be used within an AddressesProvider');
  }
  return context;
}
