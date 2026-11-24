import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '../lib/supabase';

type AuthValue = { session: Session | null; user: User | null; loading: boolean; signOut: () => Promise<void> };

const AuthContext = createContext<AuthValue | null>(null);

/** Eventos que contam como "a pessoa está usando". */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export const IDLE_NOTICE_KEY = 'firestock-idle-logout';

/** `idleMinutes`: sem nenhuma atividade por esse tempo, a sessão é encerrada (RF003 do PRD: expiração por inatividade). */
export function AuthProvider({ children, idleMinutes }: { children: ReactNode; idleMinutes: number }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // Only plain state updates inside this callback: other supabase.auth calls here can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const hasSession = Boolean(session);
  useEffect(() => {
    if (!hasSession) return;
    let timer: ReturnType<typeof setTimeout>;
    const expire = async () => {
      try {
        sessionStorage.setItem(IDLE_NOTICE_KEY, '1');
      } catch {
        // sem sessionStorage (janela privada): só não mostra o aviso
      }
      await supabase.auth.signOut().catch(() => undefined);
      setSession(null);
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, idleMinutes * 60 * 1000);
    };
    reset();
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [hasSession, idleMinutes]);

  const signOut = async () => {
    await supabase.auth.signOut().catch(() => undefined);
    setSession(null);
  };

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return value;
}
