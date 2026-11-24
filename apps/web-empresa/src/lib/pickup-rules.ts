/**
 * Regras da tela de retiradas. Funções puras, sem rede, para poder testar.
 * O cliente vê o código no app como "FS-123456"; o banco guarda só os 6 dígitos (reservations.pickup_code).
 */

export type ReservationStatus = 'pending' | 'confirmed' | 'picked_up' | 'cancelled' | 'expired' | 'no_show';
export type Fulfillment = 'pickup' | 'delivery';
export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro';
/** Etapa marcada pela loja enquanto o pedido está em aberto (reservations.stage). */
export type Stage = 'received' | 'preparing' | 'ready' | 'out_for_delivery';

export const FULFILLMENT_LABEL: Record<Fulfillment, string> = { pickup: 'Retirar no local', delivery: 'Delivery' };

export const PICKUP_CODE_LENGTH = 6;

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: 'Aguardando retirada',
  confirmed: 'Aguardando retirada',
  picked_up: 'Retirada',
  cancelled: 'Cancelada',
  expired: 'Vencida',
  no_show: 'Não retirada',
};

/** "fs-123 456" → "123456". Aceita o código como o cliente mostra no app. */
export function normalizePickupCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, PICKUP_CODE_LENGTH);
}

export function isCompletePickupCode(input: string): boolean {
  return normalizePickupCode(input).length === PICKUP_CODE_LENGTH;
}

/** Rótulo da situação: o fim de um pedido de delivery é "Entregue"; o de retirada, "Retirada". */
export function statusLabel(status: ReservationStatus, fulfillment: Fulfillment): string {
  if (fulfillment === 'delivery') {
    if (status === 'picked_up') return 'Entregue';
    if (status === 'pending' || status === 'confirmed') return 'Aguardando entrega';
  }
  return RESERVATION_STATUS_LABEL[status];
}

/** Nome da etapa em aberto, como o cliente também vê no app. */
export function stageLabel(fulfillment: Fulfillment, stage: Stage): string {
  if (stage === 'preparing') return fulfillment === 'delivery' ? 'Separando os produtos' : 'Separando o pedido';
  if (stage === 'ready') return 'Pronto para retirar';
  if (stage === 'out_for_delivery') return 'Pedido a caminho';
  return 'Pedido recebido';
}

/** Etapas de cada tipo de pedido, na ordem (a última é a conclusão: retirado/entregue). */
export function stageFlow(fulfillment: Fulfillment): string[] {
  return fulfillment === 'delivery'
    ? ['Pedido recebido', 'Separando os produtos', 'Pedido a caminho', 'Pedido entregue']
    : ['Pedido recebido', 'Separando o pedido', 'Pronto para retirar', 'Retirado'];
}

/** Posição da etapa atual em stageFlow (0 a 2 enquanto está em aberto). */
export function stageIndex(stage: Stage): number {
  if (stage === 'preparing') return 1;
  if (stage === 'ready' || stage === 'out_for_delivery') return 2;
  return 0;
}

export type NextAction = { kind: 'advance'; stage: Stage; label: string } | { kind: 'complete'; label: string };

/** O botão principal de cada pedido: avançar para a próxima etapa ou, na última, confirmar retirada/entrega. */
export function nextAction(fulfillment: Fulfillment, stage: Stage): NextAction {
  if (stage === 'received') return { kind: 'advance', stage: 'preparing', label: 'Começar a separar' };
  if (stage === 'preparing') {
    return fulfillment === 'delivery'
      ? { kind: 'advance', stage: 'out_for_delivery', label: 'Saiu para entrega' }
      : { kind: 'advance', stage: 'ready', label: 'Pronto para retirar' };
  }
  return { kind: 'complete', label: confirmLabel(fulfillment) };
}

/** Texto do botão de confirmação de cada pedido. */
export function confirmLabel(fulfillment: Fulfillment): string {
  return fulfillment === 'delivery' ? 'Confirmar entrega' : 'Confirmar retirada';
}

/**
 * O que a loja precisa saber sobre o pagamento: quanto cobrar no balcão/na entrega, ou que já foi pago no app.
 * `null` para pedidos antigos, feitos antes de o app informar a forma de pagamento.
 */
export function paymentInstruction(
  method: PaymentMethod | null,
  fulfillment: Fulfillment,
  amountDueCents: number,
  formatCents: (cents: number) => string,
): { text: string; collect: boolean } | null {
  if (!method) return null;
  if (method === 'dinheiro') {
    const where = fulfillment === 'delivery' ? 'na entrega' : 'no balcão';
    return { text: `Cobrar ${where}: ${formatCents(amountDueCents)}`, collect: true };
  }
  return { text: `Pago no app (${method === 'pix' ? 'Pix' : 'cartão'})`, collect: false };
}

export function isOpenReservation(status: ReservationStatus): boolean {
  return status === 'pending' || status === 'confirmed';
}

/** "Retirar até 18:30" / "Prazo vencido há 20 min" / null sem prazo. */
export function deadlineText(deadlineIso: string | null, now: Date): { text: string; late: boolean } | null {
  if (!deadlineIso) return null;
  const deadline = new Date(deadlineIso);
  const minutes = Math.round((deadline.getTime() - now.getTime()) / 60000);
  if (minutes >= 0) {
    const clock = deadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const sameDay = deadline.toDateString() === now.toDateString();
    return { text: sameDay ? `Retirar até ${clock}` : `Retirar até ${deadline.toLocaleDateString('pt-BR')} ${clock}`, late: false };
  }
  const late = -minutes;
  return { text: late < 60 ? `Prazo vencido há ${late} min` : `Prazo vencido há ${Math.floor(late / 60)} h`, late: true };
}
