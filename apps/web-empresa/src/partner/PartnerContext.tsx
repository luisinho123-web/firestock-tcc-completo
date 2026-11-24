import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';

export type PartnerStatus = 'pending' | 'approved' | 'rejected';

export type Partner = {
  id: string;
  trade_name: string;
  legal_name: string;
  status: PartnerStatus;
  rejection_reason: string | null;
  logo_url: string | null;
  banner_url: string | null;
};

type PartnerValue = { partner: Partner | null; loading: boolean; error: boolean; reload: () => Promise<Partner | null> };

const PartnerContext = createContext<PartnerValue | null>(null);

/** Onde a pessoa deve estar, dado o estado da empresa dela. */
export function homePath(partner: Partner | null): string {
  if (!partner) return '/empresa';
  return partner.status === 'approved' ? '/produtos' : '/aguardando';
}

export function PartnerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return null;
    const { data, error: queryError } = await supabase
      .from('partners')
      .select('id, trade_name, legal_name, status, rejection_reason, logo_url, banner_url')
      .eq('owner_id', user.id)
      .maybeSingle();
    setError(Boolean(queryError));
    const found = (data as Partner | null) ?? null;
    setPartner(found);
    setLoading(false);
    return found;
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return <PartnerContext.Provider value={{ partner, loading, error, reload: load }}>{children}</PartnerContext.Provider>;
}

export function usePartner(): PartnerValue {
  const value = useContext(PartnerContext);
  if (!value) throw new Error('usePartner precisa estar dentro de <PartnerProvider>.');
  return value;
}
