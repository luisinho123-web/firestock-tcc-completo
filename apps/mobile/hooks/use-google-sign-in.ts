import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { useProfile } from '@/contexts/profile-context';
import { errorMessage, restoreSession } from '@/services/auth';
import { startGoogleSignIn } from '@/services/google-auth';

/** Passa a sessão aberta pelo Google para o estado do app (mesmos campos que o login por e-mail preenche). */
export function useAdoptSession() {
  const router = useRouter();
  const { setName, setEmail, setToken, setIsAuthenticated } = useProfile();

  return async (): Promise<boolean> => {
    const session = await restoreSession();
    if (!session) return false;
    setEmail(session.user.email);
    setName(session.user.name);
    setToken(session.token);
    // userId e foto vêm do gatilho SIGNED_IN em profile-context.tsx, como no login por e-mail.
    setIsAuthenticated(true);
    router.replace('/home');
    return true;
  };
}

/** Botão "Continuar com Google": abre o login, e ao voltar entra no app. */
export function useGoogleSignIn() {
  const adoptSession = useAdoptSession();
  const [isLoading, setIsLoading] = useState(false);

  const signIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await startGoogleSignIn();
      if (result === 'signed_in') await adoptSession();
      // 'redirecting' (web): a página vai para o Google e volta em /auth-callback.
    } catch (error) {
      Alert.alert('Não foi possível entrar com o Google', errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return { signIn, isLoading };
}
