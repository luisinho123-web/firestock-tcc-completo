import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useOrders } from '@/contexts/order-context';
import { useProfile } from '@/contexts/profile-context';

/**
 * Tocar num aviso de pedido (com o app fechado, em segundo plano ou aberto) abre aquele pedido. O servidor manda
 * `{ type: 'order-status', reservationId }` junto do push. Não desenha nada.
 */
export function PushTapHandler() {
  // useLastNotificationResponse também devolve o toque que abriu o app do zero.
  const response = Notifications.useLastNotificationResponse();
  const router = useRouter();
  const { isAuthenticated } = useProfile();
  const { orders } = useOrders();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !response || !isAuthenticated) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;

    const data = response.notification.request.content.data as { type?: string; reservationId?: string } | undefined;
    if (data?.type !== 'order-status') return;

    const order = orders.find((item) => item.reservationId === data.reservationId);
    // Com o app recém-aberto os pedidos ainda podem estar carregando: espera, em vez de cair na lista sem necessidade.
    if (!order && orders.length === 0) return;

    handled.current = id;
    if (order) router.push({ pathname: '/order/[id]', params: { id: order.id } });
    else router.push('/orders');
  }, [response, isAuthenticated, orders, router]);

  return null;
}
