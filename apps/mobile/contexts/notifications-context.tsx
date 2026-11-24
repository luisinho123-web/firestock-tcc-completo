import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { STATUS_ETA_MINUTES, isPickup, useOrders, type Order } from '@/contexts/order-context';
import { useProfile } from '@/contexts/profile-context';
import { getPartner } from '@/data/partners';
import { seededPick } from '@/utils/seeded';

export type NotificationKind = 'confirmed' | 'preparing' | 'ready' | 'delivery' | 'delivered' | 'cancelled' | 'promo' | 'coupon';
export type NotificationCategory = 'pedidos' | 'promocoes' | 'conta';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  /** The order this notification is about, so tapping it can open that order. */
  orderId?: string;
};

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** Same list (and seed) as the tracking screen, so the courier named here is the one shown there. */
export const COURIER_NAMES = ['Carlos Moura', 'Ana Beatriz', 'João Pedro', 'Fernanda Lima'];

function marketNameFor(marketId: string): string {
  return getPartner(marketId)?.name ?? 'o mercado';
}

let notificationSeq = 0;
function nextId(): string {
  notificationSeq += 1;
  return `notif-${Date.now()}-${notificationSeq}`;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { userId } = useProfile();
  const { orders } = useOrders();
  // No seeded promo/coupon content: the feed starts empty and fills up from real order events below.
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const pushNotification = useCallback((entry: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    setNotifications((current) => [{ ...entry, id: nextId(), createdAt: Date.now(), read: false }, ...current]);
  }, []);

  const seenConfirmed = useRef(new Set<string>());
  const seenDelivery = useRef(new Set<string>());
  // Etapas que a loja marca no web-empresa (separando / pronto para retirar).
  const seenPreparing = useRef(new Set<string>());
  const seenReady = useRef(new Set<string>());
  const seenDelivered = useRef(new Set<string>());
  const seenCancelled = useRef(new Set<string>());

  // Same account-switch leak as cart-context.tsx: without this, a second person signing in on the same
  // device would see the previous shopper's notification feed. order-context.tsx already clears `orders`
  // on the same change, but the notifications already generated from them wouldn't clear on their own.
  useEffect(() => {
    setNotifications([]);
    seenConfirmed.current.clear();
    seenDelivery.current.clear();
    seenPreparing.current.clear();
    seenReady.current.clear();
    seenDelivered.current.clear();
    seenCancelled.current.clear();
  }, [userId]);

  useEffect(() => {
    orders.forEach((order: Order) => {
      const marketName = marketNameFor(order.marketId);

      if (!seenConfirmed.current.has(order.id)) {
        seenConfirmed.current.add(order.id);
        pushNotification({
          kind: 'confirmed',
          category: 'pedidos',
          orderId: order.id,
          title: isPickup(order) ? 'Reserva confirmada' : 'Pedido confirmado',
          message: isPickup(order)
            ? `Sua reserva #${order.code} no ${marketName} está garantida. Mostre o código no balcão para retirar.`
            : `O ${marketName} aceitou seu pedido #${order.code}.`,
        });
      }

      if (order.reservationId && order.status === 'preparando' && !seenPreparing.current.has(order.id)) {
        seenPreparing.current.add(order.id);
        pushNotification({
          kind: 'preparing',
          category: 'pedidos',
          orderId: order.id,
          title: isPickup(order) ? 'Separando o seu pedido' : 'Separando os seus produtos',
          message: `O ${marketName} começou a separar o pedido #${order.code}.`,
        });
      }

      if (order.status === 'pronto' && !seenReady.current.has(order.id)) {
        seenReady.current.add(order.id);
        pushNotification({
          kind: 'ready',
          category: 'pedidos',
          orderId: order.id,
          title: 'Pedido pronto para retirar!',
          message: `Seu pedido #${order.code} está pronto no ${marketName}. Mostre o código no balcão.`,
        });
      }

      if (order.status === 'a_caminho' && !seenDelivery.current.has(order.id)) {
        seenDelivery.current.add(order.id);
        const courier = seededPick(order.code, COURIER_NAMES);
        pushNotification({
          kind: 'delivery',
          category: 'pedidos',
          orderId: order.id,
          title: 'Seu pedido saiu para entrega',
          // Pedidos com reserva no banco são entregues pela loja; o entregador com nome é da simulação antiga.
          message: order.reservationId
            ? `O ${marketName} saiu para entregar o pedido #${order.code}.`
            : `${courier} está a caminho com seu pedido do ${marketName}. Chega em ${STATUS_ETA_MINUTES.a_caminho} min.`,
        });
      }

      if (order.status === 'entregue' && !seenDelivered.current.has(order.id)) {
        seenDelivered.current.add(order.id);
        pushNotification({
          kind: 'delivered',
          category: 'pedidos',
          orderId: order.id,
          title: isPickup(order) ? 'Pedido retirado. Como foi?' : 'Como foi seu pedido?',
          message: `Avalie sua compra no ${marketName} e ajude outros clientes.`,
        });
      }

      if (order.status === 'cancelado' && !seenCancelled.current.has(order.id)) {
        seenCancelled.current.add(order.id);
        pushNotification({
          kind: 'cancelled',
          category: 'pedidos',
          orderId: order.id,
          title: isPickup(order) ? 'Reserva cancelada' : 'Pedido cancelado',
          message: order.cancelledByStore
            ? `O ${marketName} cancelou o pedido #${order.code}.${order.paymentMethod === 'dinheiro' ? '' : ' O valor será estornado.'}`
            : `Você cancelou o pedido #${order.code} no ${marketName}.${order.paymentMethod === 'dinheiro' ? '' : ' O valor será estornado.'}`,
        });
      }
    });
  }, [orders, pushNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
