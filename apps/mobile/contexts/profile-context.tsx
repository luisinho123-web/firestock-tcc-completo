import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { restoreSession } from '@/services/auth';
import { profileService, supabase } from '@/services/supabase';

type ProfileContextValue = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  memberSince: number;
  token: string;
  isAuthenticated: boolean;
  /** True until the session saved on the device has been checked; screens that redirect on auth should wait. */
  isRestoringSession: boolean;
  userId: string;
  avatarUrl: string | null;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setCpf: (cpf: string) => void;
  setBirthDate: (birthDate: string) => void;
  setToken: (token: string) => void;
  setIsAuthenticated: (value: boolean) => void;
  setUserId: (id: string) => void;
  setAvatarUrl: (url: string | null) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [memberSince] = useState(() => Date.now());
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [userId, setUserId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // restoreSession never rejects; a missing or broken saved session just leaves the user signed out.
    restoreSession().then((session) => {
      if (!active) return;
      if (session) {
        setName(session.user.name);
        setEmail(session.user.email);
        setToken(session.token);
        setIsAuthenticated(true);
        setUserId(session.user.id);
        // Best-effort: a failed/slow profile fetch never blocks the auth restore itself. full_name is
        // NOT NULL in the database, so an empty one back here only ever means the fetch itself failed —
        // in that case keep the name the auth session already gave us instead of blanking it.
        profileService.getMyProfile(session.user.id).then(({ avatarUrl, fullName, phone, cpf, birthDate }) => {
          if (!active) return;
          setAvatarUrl(avatarUrl);
          if (fullName) setName(fullName);
          setPhone(phone);
          setCpf(cpf);
          setBirthDate(birthDate);
        });
      }
      setIsRestoringSession(false);
    });

    // Only plain state updates inside this callback: calling other supabase.auth methods here can deadlock.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        setToken(session.access_token);
      } else if (event === 'SIGNED_IN' && session) {
        // Fires after a fresh login/registration (not on the cold-start restore above, which uses
        // getSession() directly and already fetches the profile itself) — same best-effort fetch.
        setUserId(session.user.id);
        profileService.getMyProfile(session.user.id).then(({ avatarUrl, fullName, phone, cpf, birthDate }) => {
          if (!active) return;
          setAvatarUrl(avatarUrl);
          if (fullName) setName(fullName);
          setPhone(phone);
          setCpf(cpf);
          setBirthDate(birthDate);
        });
      } else if (event === 'SIGNED_OUT') {
        setName('');
        setEmail('');
        setPhone('');
        setCpf('');
        setBirthDate('');
        setToken('');
        setIsAuthenticated(false);
        setUserId('');
        setAvatarUrl(null);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        name,
        email,
        phone,
        cpf,
        birthDate,
        memberSince,
        token,
        isAuthenticated,
        isRestoringSession,
        userId,
        avatarUrl,
        setName,
        setEmail,
        setPhone,
        setCpf,
        setBirthDate,
        setToken,
        setIsAuthenticated,
        setUserId,
        setAvatarUrl,
      }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
