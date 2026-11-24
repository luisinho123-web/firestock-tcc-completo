import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '../auth/AuthContext';
import { getMyRole } from './api';

type AdminValue = { isAdmin: boolean; name: string; loading: boolean; error: boolean };

const AdminContext = createContext<AdminValue | null>(null);

/**
 * Descobre se quem entrou é administrador (`profiles.role = 'admin'`). Isto só decide o que a tela mostra: quem protege os
 * dados de verdade são as regras de acesso (RLS) do banco. Um usuário comum que chegue aqui não consegue ler nada de admin.
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [value, setValue] = useState<AdminValue>({ isAdmin: false, name: '', loading: true, error: false });

  useEffect(() => {
    if (!user) return;
    let active = true;
    getMyRole(user.id)
      .then((profile) => {
        if (active) setValue({ isAdmin: profile?.role === 'admin', name: profile?.name ?? '', loading: false, error: false });
      })
      .catch(() => {
        if (active) setValue({ isAdmin: false, name: '', loading: false, error: true });
      });
    return () => {
      active = false;
    };
  }, [user]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin precisa estar dentro de <AdminProvider>.');
  return value;
}
