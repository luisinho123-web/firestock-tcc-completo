import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useProfile } from '@/contexts/profile-context';
import { DEFAULT_PREFS, type NotificationChannel } from '@/services/notification-prefs';
import { getPermissionState, registerForPushAsync, type PermissionState } from '@/services/push';
import { notificationPrefsService } from '@/services/supabase';

const TOKEN_KEY = 'firestock-push-token';

type SaveResult = { warning: string | null };

type NotificationPrefsValue = {
  channel: NotificationChannel;
  /** Dígitos nacionais do WhatsApp (DDD + número). */
  phoneDigits: string;
  loading: boolean;
  /** Permissão de notificação do aparelho. */
  permission: PermissionState;
  /** Por que o push não está ativo neste aparelho (Expo Go, sem Firebase, permissão negada...), ou null. */
  pushProblem: string | null;
  /** Salva a escolha. Lança Error com mensagem para a pessoa; o `warning` avisa se o canal foi salvo mas o push não ativou. */
  save: (channel: NotificationChannel, phone: string) => Promise<SaveResult>;
  refresh: () => Promise<void>;
  /** Tira este aparelho da lista de push (chamar antes de sair da conta). Nunca lança. */
  unregisterThisDevice: () => Promise<void>;
};

const NotificationPrefsContext = createContext<NotificationPrefsValue | null>(null);

async function readStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function NotificationPrefsProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthenticated } = useProfile();
  const [channel, setChannel] = useState<NotificationChannel>(DEFAULT_PREFS.channel);
  const [phoneDigits, setPhoneDigits] = useState(DEFAULT_PREFS.phoneDigits);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [pushProblem, setPushProblem] = useState<string | null>(null);
  const channelRef = useRef(channel);
  channelRef.current = channel;

  /** Liga o push neste aparelho: permissão, token e registro no servidor. Devolve o problema (ou null). */
  const syncPush = useCallback(async (askPermission: boolean): Promise<string | null> => {
    const result = await registerForPushAsync({ askPermission });
    setPermission(await getPermissionState());

    if (result.status === 'registered') {
      try {
        await notificationPrefsService.registerPushToken(result.token, result.platform);
        await AsyncStorage.setItem(TOKEN_KEY, result.token).catch(() => undefined);
        setPushProblem(null);
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível ativar as notificações neste aparelho.';
        setPushProblem(message);
        return message;
      }
    }

    const message =
      result.status === 'unsupported'
        ? result.reason
        : result.status === 'denied'
          ? 'A permissão de notificações está desligada. Ligue nos ajustes do aparelho.'
          : result.message;
    setPushProblem(message);
    return message;
  }, []);

  const unregisterThisDevice = useCallback(async () => {
    try {
      const token = await readStoredToken();
      if (token) await notificationPrefsService.unregisterPushToken(token);
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {
      // Sem rede: o servidor só envia push a quem escolheu esse canal, então não há aviso indevido.
    }
  }, []);

  // Carrega as preferências ao entrar na conta e, se o canal for push, liga o push neste aparelho.
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setChannel(DEFAULT_PREFS.channel);
      setPhoneDigits(DEFAULT_PREFS.phoneDigits);
      setPushProblem(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const prefs = await notificationPrefsService.getPrefs(userId);
      if (!active) return;
      setChannel(prefs.channel);
      setPhoneDigits(prefs.phoneDigits);
      setLoading(false);
      if (prefs.channel === 'push') await syncPush(true);
      else setPermission(await getPermissionState());
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, userId, syncPush]);

  const refresh = useCallback(async () => {
    setPermission(await getPermissionState());
    // Voltou dos ajustes do aparelho (ou ficou muito tempo em segundo plano): confere se o push já pode ser ligado.
    if (channelRef.current === 'push') await syncPush(false);
  }, [syncPush]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [isAuthenticated, refresh]);

  const save = useCallback(
    async (nextChannel: NotificationChannel, phone: string): Promise<SaveResult> => {
      const saved = await notificationPrefsService.savePrefs(userId, { channel: nextChannel, phone });
      setChannel(saved.channel);
      setPhoneDigits(saved.phoneDigits);

      if (nextChannel === 'push') return { warning: await syncPush(true) };

      // Outro canal: este aparelho deixa de receber push.
      await unregisterThisDevice();
      setPushProblem(null);
      return { warning: null };
    },
    [userId, syncPush, unregisterThisDevice],
  );

  return (
    <NotificationPrefsContext.Provider value={{ channel, phoneDigits, loading, permission, pushProblem, save, refresh, unregisterThisDevice }}>
      {children}
    </NotificationPrefsContext.Provider>
  );
}

export function useNotificationPrefs(): NotificationPrefsValue {
  const value = useContext(NotificationPrefsContext);
  if (!value) throw new Error('useNotificationPrefs must be used within a NotificationPrefsProvider');
  return value;
}
