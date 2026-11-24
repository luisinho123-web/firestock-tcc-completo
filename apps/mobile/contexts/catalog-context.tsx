import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, RefreshControl } from 'react-native';

import { useProfile } from '@/contexts/profile-context';
import { refreshCatalog } from '@/services/catalog';

// PRODUCTS e PARTNERS são arrays de módulo alterados no lugar quando o catálogo real chega; este contador avisa as
// telas que leem esses arrays direto para renderizarem de novo.
let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getVersion = () => version;

/** Chame nas telas que leem PRODUCTS/PARTNERS/getProduct/getPartner para atualizar quando o catálogo mudar. */
export function useCatalogVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

/** Avisa as telas que leem PRODUCTS/PARTNERS que algo mudou (ex.: a distância depois de uma nova posição do GPS). */
export function notifyCatalogChanged() {
  version += 1;
  listeners.forEach((listener) => listener());
}

type CatalogValue = { ready: boolean; refresh: () => Promise<void> };

const CatalogContext = createContext<CatalogValue | null>(null);

// Com o app aberto, busca de novo a cada minuto: empresa que cadastra ou tira um produto aparece sem a pessoa sair da conta.
const POLL_INTERVAL_MS = 60_000;

/** Carrega as empresas e produtos reais depois do login, ao voltar para o primeiro plano e de minuto em minuto enquanto o app está aberto. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useProfile();
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    await refreshCatalog();
    notifyCatalogChanged();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setReady(false);
      return;
    }
    let active = true;
    refresh().then(() => {
      if (active) setReady(true);
    });
    let timer: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => {
      stopPolling();
      timer = setInterval(() => refresh(), POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    if (AppState.currentState === 'active') startPolling();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        startPolling();
      } else {
        stopPolling(); // em segundo plano não gasta bateria nem internet
      }
    });
    return () => {
      active = false;
      stopPolling();
      subscription.remove();
    };
  }, [isAuthenticated, refresh]);

  return <CatalogContext.Provider value={{ ready, refresh }}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog precisa estar dentro de <CatalogProvider>.');
  return value;
}

/** Controle de "puxar para atualizar" para o ScrollView/FlatList das telas que mostram o catálogo. */
export function useCatalogRefreshControl() {
  const { refresh } = useCatalog();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;
}
