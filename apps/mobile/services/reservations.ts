/**
 * Reservas no Supabase. A escrita passa só pelas funções do banco (supabase/migrations/reservations_flow.sql):
 * o banco confere preço, estoque e dono, e é a partir dessas linhas que os painéis da empresa e do admin contam vendas.
 *   create_reservation  -> grava a reserva (retirada ou delivery) e os itens e baixa o estoque
 *   cancel_reservation  -> cancela e devolve o estoque
 * A loja confirma no web-empresa que o pedido foi retirado ou entregue (status `picked_up`, que vira VENDA nos painéis);
 * o app lê esse status com fetchStates para mostrar "Retirado"/"Entregue".
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ReservationLine = { productId: string; quantity: number };

/** Retirar no local ou delivery (coluna reservations.fulfillment). */
export type ReservationFulfillment = 'pickup' | 'delivery';

export type CreateReservationInput = {
  partnerId: string;
  lines: ReservationLine[];
  fulfillment: ReservationFulfillment;
  /** Obrigatório no delivery. */
  deliveryAddress?: string;
  paymentMethod: 'pix' | 'cartao' | 'dinheiro';
  /** Só para a loja saber quanto cobrar; a receita nos painéis continua sendo só os itens. */
  deliveryFeeCents: number;
  discountCents: number;
};

export type ReservationStatus = 'pending' | 'confirmed' | 'picked_up' | 'cancelled' | 'expired' | 'no_show';

/** Etapa que a loja marcou no web-empresa enquanto o pedido está em aberto (reservations.stage). */
export type ReservationStage = 'received' | 'preparing' | 'ready' | 'out_for_delivery';

export type ReservationState = {
  id: string;
  status: ReservationStatus;
  stage: ReservationStage;
  preparingAt: string | null;
  readyAt: string | null;
  outForDeliveryAt: string | null;
  pickedUpAt: string | null;
  cancelledAt: string | null;
};

type StateRow = {
  id: string;
  status: ReservationStatus;
  stage: ReservationStage | null;
  preparing_at: string | null;
  ready_at: string | null;
  out_for_delivery_at: string | null;
  picked_up_at: string | null;
  cancelled_at: string | null;
};

export type CreatedReservation = {
  id: string;
  pickupCode: string;
  totalCents: number;
  pickupDeadline: string | null;
};

type RpcError = { code?: string; message?: string } | null;

/** Mensagens que o próprio banco escreve (errcode P0001) já são para o usuário; o resto vira texto genérico. */
function rpcMessage(error: RpcError, fallback: string): string {
  if (error?.code === 'P0001' && error.message) return error.message;
  if (error?.message?.toLowerCase().includes('fetch')) return 'Sem conexão com a internet. Tente novamente.';
  return fallback;
}

export function createReservationsService(client: SupabaseClient) {
  async function createReservation(input: CreateReservationInput): Promise<CreatedReservation> {
    const items = input.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity }));
    const { data, error } = await client.rpc('create_reservation', {
      p_partner_id: input.partnerId,
      p_items: items,
      p_fulfillment: input.fulfillment,
      p_delivery_address: input.fulfillment === 'delivery' ? input.deliveryAddress ?? null : null,
      p_payment_method: input.paymentMethod,
      p_delivery_fee_cents: Math.max(0, Math.round(input.deliveryFeeCents)),
      p_discount_cents: Math.max(0, Math.round(input.discountCents)),
    });
    if (error) throw new Error(rpcMessage(error, 'Não foi possível registrar o pedido. Tente novamente.'));

    const row = (Array.isArray(data) ? data[0] : data) as
      | { reservation_id: string; pickup_code: string; total_cents: number; pickup_deadline: string | null }
      | undefined;
    if (!row?.reservation_id) throw new Error('Não foi possível registrar o pedido. Tente novamente.');
    return { id: row.reservation_id, pickupCode: row.pickup_code, totalCents: row.total_cents, pickupDeadline: row.pickup_deadline };
  }

  async function cancelReservation(reservationId: string): Promise<void> {
    const { error } = await client.rpc('cancel_reservation', { p_reservation_id: reservationId });
    if (error) throw new Error(rpcMessage(error, 'Não foi possível cancelar o pedido. Tente novamente.'));
  }

  /** Situação atual das reservas do próprio cliente (a regra de acesso só deixa ler as dele). */
  async function fetchStates(ids: string[]): Promise<ReservationState[]> {
    if (ids.length === 0) return [];
    const { data, error } = await client
      .from('reservations')
      .select('id, status, stage, preparing_at, ready_at, out_for_delivery_at, picked_up_at, cancelled_at')
      .in('id', ids);
    if (error) throw new Error('Não foi possível atualizar seus pedidos.');
    return ((data ?? []) as StateRow[]).map((row) => ({
      id: row.id,
      status: row.status,
      stage: row.stage ?? 'received',
      preparingAt: row.preparing_at,
      readyAt: row.ready_at,
      outForDeliveryAt: row.out_for_delivery_at,
      pickedUpAt: row.picked_up_at,
      cancelledAt: row.cancelled_at,
    }));
  }

  return { createReservation, cancelReservation, fetchStates };
}
