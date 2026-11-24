/**
 * Parte nativa do push: permissão, canal do Android e token do Expo. O envio dos avisos é do servidor
 * (supabase/functions/notify-order-status); aqui o aparelho só se identifica e mostra o que chega.
 *
 * Requisitos reais (docs/NOTIFICACOES.md): app instalado de um build (APK), não o Expo Go no Android; Firebase (FCM) ligado
 * ao projeto Expo; aparelho de verdade. Em qualquer outro caso o resultado é "unsupported" ou "error" com uma explicação,
 * e o app segue normal.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

/** Mesmo canal que o servidor usa em cada push (supabase/functions/_shared/expo-push.ts). */
export const ANDROID_CHANNEL_ID = 'orders';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export type PushRegistration =
  | { status: 'registered'; token: string; platform: 'android' | 'ios' }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; message: string };

/** Por que este ambiente não recebe push (ou null se pode receber). */
export function pushUnsupportedReason(): string | null {
  if (Platform.OS === 'web') return 'As notificações no celular só funcionam no aplicativo instalado.';
  if (!Device.isDevice) return 'Notificações push precisam de um aparelho de verdade (não funcionam no emulador).';
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'No Android, o Expo Go não recebe notificações push. Use o aplicativo instalado (APK).';
  }
  return null;
}

/** Como o app mostra um aviso que chega com ele aberto: como banner, com som (igual a quando está fechado). */
export function configureNotificationHandler() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function getPermissionState(): Promise<PermissionState> {
  if (pushUnsupportedReason()) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * Pede permissão (se ainda não foi decidida) e devolve o token deste aparelho. Com `askPermission: false` nunca abre o
 * diálogo do sistema: só registra se a permissão já estiver concedida.
 */
export async function registerForPushAsync(options: { askPermission: boolean }): Promise<PushRegistration> {
  const unsupported = pushUnsupportedReason();
  if (unsupported) return { status: 'unsupported', reason: unsupported };

  try {
    if (Platform.OS === 'android') {
      // O canal precisa existir antes de pedir a permissão no Android 13+.
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Pedidos',
        description: 'Avisos sobre o andamento dos seus pedidos',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F05219',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && options.askPermission && status !== 'denied') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return status === 'denied' ? { status: 'denied' } : { status: 'error', message: 'Permissão ainda não concedida.' };

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return { status: 'error', message: 'Projeto Expo não configurado (extra.eas.projectId no app.json).' };

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'registered', token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    // Sem o Firebase (google-services.json) o Android não consegue gerar o token.
    const firebase = /firebase|fcm|google-services/i.test(detail);
    return {
      status: 'error',
      message: firebase
        ? 'O Firebase (FCM) ainda não está configurado neste app. Veja docs/NOTIFICACOES.md.'
        : 'Não foi possível ativar as notificações neste aparelho.',
    };
  }
}

/** Abre os ajustes do aparelho (onde a pessoa liga a permissão de notificações depois de negar). */
export function openNotificationSettings() {
  return Linking.openSettings();
}
