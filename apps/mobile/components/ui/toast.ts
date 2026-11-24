/**
 * Aviso de confirmação ("Endereço salvo", "Cartão removido"…): aparece no topo da tela por alguns segundos, em qualquer
 * plataforma, mesmo depois de a tela que salvou já ter fechado (router.back()). Desenhado por <ToastHost /> (layout raiz).
 */
export type ToastType = 'success' | 'error' | 'info';
export type ToastMessage = { id: number; type: ToastType; text: string };

const queue: ToastMessage[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

const DURATION: Record<ToastType, number> = { success: 3500, info: 3500, error: 5500 };

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let snapshot: ToastMessage | null = null;
export function getCurrentToast(): ToastMessage | null {
  return snapshot;
}

function refresh() {
  snapshot = queue[0] ?? null;
  emit();
}

export function dismissToast(id: number) {
  const index = queue.findIndex((toast) => toast.id === id);
  if (index >= 0) queue.splice(index, 1);
  refresh();
}

function show(type: ToastType, text: string) {
  const toast: ToastMessage = { id: nextId++, type, text };
  queue.push(toast);
  if (queue.length === 1) refresh();
  setTimeout(() => dismissToast(toast.id), DURATION[type] + (queue.length - 1) * 800);
}

export const toast = {
  success: (text: string) => show('success', text),
  error: (text: string) => show('error', text),
  info: (text: string) => show('info', text),
};
