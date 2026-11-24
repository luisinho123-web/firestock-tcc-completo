/**
 * Textos dos avisos de pedido (push e WhatsApp usam o mesmo texto). Sem dependências: roda no Deno (Edge Function) e no Node (testes).
 * Os eventos são os mesmos de public.notification_outbox.event (supabase/migrations/notifications_delivery.sql).
 */

export type OrderEvent = 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled' | 'expired';
export type Fulfillment = 'pickup' | 'delivery';

export const ORDER_EVENTS: readonly OrderEvent[] = ['preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'expired'];

export function isOrderEvent(value: unknown): value is OrderEvent {
  return typeof value === 'string' && (ORDER_EVENTS as readonly string[]).includes(value);
}

export type MessageContext = {
  partnerName: string | null;
  /** Código do pedido (reservations.pickup_code), o mesmo que o cliente mostra no balcão. */
  code: string;
  fulfillment: Fulfillment;
  /** reservations.payment_method: pagamento em dinheiro não tem estorno. */
  paymentMethod?: string | null;
};

export type OrderMessage = { title: string; body: string };

export function buildOrderMessage(event: OrderEvent, ctx: MessageContext): OrderMessage {
  const name = ctx.partnerName?.trim();
  const store = name ? `a loja ${name}` : 'a loja'; // "A loja X começou..."
  const inStore = name ? `na loja ${name}` : 'na loja'; // "...pronto na loja X"
  const order = `#${ctx.code}`;
  const pickup = ctx.fulfillment === 'pickup';

  switch (event) {
    case 'preparing':
      return {
        title: pickup ? 'Separando o seu pedido' : 'Separando os seus produtos',
        body: `${capitalize(store)} começou a separar o pedido ${order}.`,
      };
    case 'ready':
      return {
        title: 'Pedido pronto para retirar!',
        body: `Seu pedido ${order} está pronto ${inStore}. Mostre o código no balcão.`,
      };
    case 'out_for_delivery':
      return {
        title: 'Seu pedido saiu para entrega',
        body: `${capitalize(store)} saiu para entregar o pedido ${order}.`,
      };
    case 'completed':
      return {
        title: pickup ? 'Pedido retirado. Como foi?' : 'Pedido entregue. Como foi?',
        body: `Avalie sua compra ${inStore} e ajude outros clientes.`,
      };
    case 'cancelled':
      return {
        title: 'Pedido cancelado',
        body: `O pedido ${order} ${inStore} foi cancelado.${ctx.paymentMethod === 'dinheiro' ? '' : ' Se você já pagou, o valor será estornado.'}`,
      };
    case 'expired':
      return {
        title: 'Reserva vencida',
        body: `A reserva ${order} ${inStore} venceu sem ser retirada.`,
      };
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
