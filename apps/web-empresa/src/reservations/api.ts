import { normalizePickupCode, type Fulfillment, type PaymentMethod, type ReservationStatus, type Stage } from '../lib/pickup-rules';
import { supabase } from '../lib/supabase';

export type ReservationItem = { product_id: string; quantity: number; unit_price_cents: number; product_name: string };

export type Reservation = {
  id: string;
  pickup_code: string;
  status: ReservationStatus;
  total_cents: number;
  created_at: string;
  pickup_deadline: string | null;
  picked_up_at: string | null;
  cancelled_at: string | null;
  fulfillment: Fulfillment;
  delivery_address: string | null;
  payment_method: PaymentMethod | null;
  delivery_fee_cents: number;
  amount_due_cents: number | null;
  stage: Stage;
  items: ReservationItem[];
};

type Row = Omit<Reservation, 'items'> & {
  reservation_items: { product_id: string; quantity: number; unit_price_cents: number; products: { name: string } | null }[] | null;
};

const COLUMNS =
  'id, pickup_code, status, total_cents, created_at, pickup_deadline, picked_up_at, cancelled_at, fulfillment, delivery_address, payment_method, delivery_fee_cents, amount_due_cents, stage, reservation_items(product_id, quantity, unit_price_cents, products(name))';

function toReservation(row: Row): Reservation {
  const { reservation_items, ...rest } = row;
  return {
    ...rest,
    items: (reservation_items ?? []).map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      product_name: item.products?.name ?? 'Produto removido',
    })),
  };
}

/** Mensagens que o banco escreve (errcode P0001) já são para o usuário; o resto vira texto genérico. */
function rpcError(error: { code?: string; message?: string }, fallback: string): Error {
  return new Error(error.code === 'P0001' && error.message ? error.message : fallback);
}

/** Reservas em aberto (aguardando retirada), da mais antiga para a mais nova. A RLS já limita à empresa do dono. */
export async function listOpenReservations(partnerId: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(COLUMNS)
    .eq('partner_id', partnerId)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: true });
  if (error) throw new Error('Não foi possível carregar as reservas.');
  return (data as unknown as Row[]).map(toReservation);
}

/** Últimas reservas encerradas (retiradas, canceladas...), da mais recente para a mais antiga. */
export async function listRecentClosed(partnerId: string, limit = 20): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(COLUMNS)
    .eq('partner_id', partnerId)
    .not('status', 'in', '(pending,confirmed)')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('Não foi possível carregar o histórico.');
  return (data as unknown as Row[]).map(toReservation);
}

/** Marca como retirada (vira VENDA no painel). Pelo id da reserva ou pelo código que o cliente mostra. */
export async function confirmPickup(target: { id: string } | { code: string }): Promise<string> {
  const args = 'id' in target ? { p_reservation_id: target.id } : { p_code: normalizePickupCode(target.code) };
  const { data, error } = await supabase.rpc('confirm_pickup', args);
  if (error) throw rpcError(error, 'Não foi possível confirmar a retirada. Tente novamente.');
  return data as string;
}

/** Avança o pedido para a próxima etapa (separando, pronto para retirar ou a caminho). O cliente vê no app. */
export async function advanceReservation(id: string, stage: Stage): Promise<void> {
  const { error } = await supabase.rpc('advance_reservation', { p_reservation_id: id, p_stage: stage });
  if (error) {
    // PGRST202 = a função não existe no banco: a migração ainda não foi aplicada.
    if (error.code === 'PGRST202') throw new Error('Falta rodar supabase/migrations/reservations_stages.sql no Supabase.');
    throw rpcError(error, 'Não foi possível atualizar a etapa do pedido. Tente novamente.');
  }
}

/** Cancela a reserva e devolve o estoque dos produtos. */
export async function cancelReservation(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_reservation', { p_reservation_id: id });
  if (error) throw rpcError(error, 'Não foi possível cancelar a reserva. Tente novamente.');
}
