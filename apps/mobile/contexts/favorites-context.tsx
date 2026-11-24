import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';

import { useProfile } from '@/contexts/profile-context';
import { errorMessage } from '@/services/auth';
import { favoritesService } from '@/services/supabase';

type FavoritesContextValue = {
  favoriteIds: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthenticated } = useProfile();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Loads (or clears) this shopper's favorites whenever who's signed in changes — mirrors
  // contexts/addresses-context.tsx. Without this, a second person signing in on the same device would
  // see the previous shopper's favorites.
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setFavoriteIds([]);
      return;
    }
    let active = true;
    favoritesService.listMyFavoriteIds(userId).then((ids) => {
      if (active) setFavoriteIds(ids);
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, userId]);

  const toggleFavorite = async (id: string) => {
    const wasFavorite = favoriteIds.includes(id);
    // Optimistic: this is tapped often and each tap is low-stakes, so flip the heart immediately and
    // only revert if the write actually fails.
    setFavoriteIds((current) => (wasFavorite ? current.filter((favoriteId) => favoriteId !== id) : [...current, id]));
    try {
      if (wasFavorite) await favoritesService.removeFavorite(userId, id);
      else await favoritesService.addFavorite(userId, id);
    } catch (error) {
      setFavoriteIds((current) => (wasFavorite ? [...current, id] : current.filter((favoriteId) => favoriteId !== id)));
      Alert.alert('Não foi possível atualizar seus favoritos', errorMessage(error));
    }
  };

  const isFavorite = (id: string) => favoriteIds.includes(id);

  return <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite }}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
