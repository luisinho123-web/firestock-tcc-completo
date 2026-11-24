import { Alert as NativeAlert, type AlertButton, Platform } from 'react-native';

/**
 * Drop-in for react-native's Alert. `Alert.alert` is a no-op on react-native-web, which made every error and
 * confirmation invisible in the browser; there the alert is queued here and drawn by <AlertHost /> (mounted
 * in the root layout) as an in-app modal. Native platforms keep the system alert.
 */
export type WebAlert = { title: string; message?: string; buttons: AlertButton[] };

const queue: WebAlert[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Subscription for <AlertHost />: the alert currently on screen, or null. */
export function subscribeToAlerts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentAlert(): WebAlert | null {
  return queue[0] ?? null;
}

export function dismissCurrentAlert(button?: AlertButton) {
  queue.shift();
  emit();
  button?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') {
      NativeAlert.alert(title, message, buttons);
      return;
    }
    queue.push({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
    emit();
  },
};
