import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { COLORS } from '@/components/ui/theme';
import { useProfile } from '@/contexts/profile-context';
import { getPartner, type Partner } from '@/data/partners';
import { getProduct, type Product } from '@/data/products';
import type { ReservationState } from '@/services/reservations';
import { reservationsService } from '@/services/supabase';

// Imagem usada quando a empresa/produto não tem foto (ou já não existe no catálogo).
const FALLBACK_IMAGE = require('../assets/images/splash-logo.png');

/**
 * Situação do pedido no app. Em pedidos com reserva no banco, quem muda é a loja no web-empresa (reservations.stage):
 *   retirada: confirmado (recebido) -> preparando -> pronto -> entregue (= retirado)
 *   delivery: confirmado (recebido) -> preparando -> a_caminho -> entregue
 */
export type OrderStatus = 'confirmado' | 'preparando' | 'pronto' | 'a_caminho' | 'entregue' | 'cancelado';

export type OrderLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  /** Cópia dos dados do produto no momento da compra: o histórico continua legível mesmo se a empresa tirar o produto do ar. */
  title?: string;
  unit?: string;
  imageUrl?: string | null;
};

/** Cópia dos dados da empresa no momento da compra (mesmo motivo de OrderLine.title). */
export type MarketSnapshot = {
  name: string;
  category: string;
  address: string;
  imageUrl: string | null;
  lat: number;
  lng: number;
};

export type DeliveryOptionKey = 'padrao' | 'expressa';

/** Como o cliente recebe: busca na loja ou pede delivery. Pedidos antigos (sem o campo) eram todos delivery. */
export type Fulfillment = 'retirada' | 'entrega';

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  retirada: 'Retirar no local',
  entrega: 'Delivery',
};

/** Prazo de retirada (RN005); o banco grava o mesmo prazo em reservations.pickup_deadline. */
export const PICKUP_WINDOW_HOURS = 4;
export type PaymentKey = 'pix' | 'cartao' | 'dinheiro';

export const DELIVERY_META: Record<DeliveryOptionKey, { label: string }> = {
  padrao: { label: 'Padrão' },
  expressa: { label: 'Expressa' },
};

/** Express delivery: flat fee and a fixed promise, whatever the market's standard window is. */
export const EXPRESS_DELIVERY = { fee: 8.9, etaMinutes: 20 };

export const PAYMENT_LABELS: Record<PaymentKey, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  confirmado: 'Pedido recebido',
  preparando: 'Separando os produtos',
  pronto: 'Pronto para retirar',
  a_caminho: 'Pedido a caminho',
  entregue: 'Pedido entregue',
  cancelado: 'Cancelado',
};

/** Compact badge copy for list contexts (Meus pedidos). The tracking screen uses its own slightly
 * longer wording ("Saiu para entrega" vs "A caminho") to match that screen's Figma spec. */
export const ORDERS_LIST_STATUS_BADGE: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  confirmado: { label: 'Pedido recebido', bg: COLORS.primarySoft, color: COLORS.navy },
  preparando: { label: 'Separando', bg: COLORS.primarySoft, color: COLORS.navy },
  pronto: { label: 'Pronto para retirar', bg: COLORS.successSoft, color: COLORS.success },
  a_caminho: { label: 'A caminho', bg: COLORS.orangeSoft, color: COLORS.orange },
  entregue: { label: 'Entregue', bg: COLORS.successSoft, color: COLORS.success },
  cancelado: { label: 'Cancelado', bg: COLORS.errorSoft, color: COLORS.error },
};

/** How many of the 4 progress segments are filled for this status — used by the compact order-list progress bar. */
export const STATUS_PROGRESS: Record<OrderStatus, number> = {
  confirmado: 1,
  preparando: 2,
  pronto: 3,
  a_caminho: 3,
  entregue: 4,
  cancelado: 0,
};

/** Simulated remaining-time display, keyed by current status rather than wall-clock time — the
 * background status simulation runs in seconds, not real minutes, so the countdown shown to the
 * user is derived from "how far along is this order" instead of literal elapsed time. */
export const STATUS_ETA_MINUTES: Record<OrderStatus, number> = {
  confirmado: 45,
  preparando: 32,
  pronto: 0,
  a_caminho: 18,
  entregue: 0,
  cancelado: 0,
};

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Prazo de retirada: "Hoje, 18:30" / "Amanhã, 01:10" (o prazo é de 4 horas, então nunca passa de amanhã). */
export function formatPickupDeadline(deadline: number | undefined, now: number = Date.now()): string {
  if (!deadline) return `Em até ${PICKUP_WINDOW_HOURS} horas`;
  const date = new Date(deadline);
  const sameDay = date.toDateString() === new Date(now).toDateString();
  return `${sameDay ? 'Hoje' : 'Amanhã'}, ${formatClock(date)}`;
}

/** "Hoje, 14:20 – 14:30" for the order's promised delivery window. */
export function formatEtaWindow(order: Pick<Order, 'createdAt' | 'etaMinMinutes' | 'etaMaxMinutes'>): string {
  const start = new Date(order.createdAt + order.etaMinMinutes * 60000);
  const end = new Date(order.createdAt + order.etaMaxMinutes * 60000);
  return order.etaMinMinutes === order.etaMaxMinutes
    ? `Hoje, ${formatClock(start)}`
    : `Hoje, ${formatClock(start)} – ${formatClock(end)}`;
}

export type Order = {
  id: string;
  code: string;
  marketId: string;
  market?: MarketSnapshot;
  address: string;
  /** Real coordinates of the delivery address chosen at checkout — the fixed destination for the tracking map. */
  addressLat: number;
  addressLng: number;
  lines: OrderLine[];
  deliveryOption: DeliveryOptionKey;
  deliveryFee: number;
  /** Delivery window promised at checkout, in minutes after `createdAt`. */
  etaMinMinutes: number;
  etaMaxMinutes: number;
  paymentMethod: PaymentKey;
  /** Human detail for the method, e.g. "Visa •••• 4242" for a saved card. */
  paymentDetail?: string;
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  createdAt: number;
  /** When the order entered each status it has reached — drives the tracking timeline's real times. */
  statusTimes: Partial<Record<OrderStatus, number>>;
  reviewed: boolean;
  reviewRating?: 1 | 2 | 3 | 4 | 5;
  /** Set by `cancelOrder` — the only way an order reaches the 'cancelado' status. */
  cancelledAt?: number;
  /** Id da reserva no Supabase (public.reservations). Pedidos antigos, feitos antes de existir a reserva no banco, não têm. */
  reservationId?: string;
  /** Retirar no local ou delivery; ausente = delivery (pedidos feitos antes da opção de retirada). */
  fulfillment?: Fulfillment;
  /** Retirada: até quando o cliente pode buscar (ms). */
  pickupDeadline?: number;
  /** A loja cancelou (ou a reserva venceu) no banco; o cliente não fez nada no app. */
  cancelledByStore?: boolean;
};

export const isPickup = (order: Pick<Order, 'fulfillment'>): boolean => order.fulfillment === 'retirada';

/** Etiqueta da situação nas listas e no detalhe: na retirada não existe "a caminho", e o fim é "Retirado". */
export function orderStatusBadge(order: Pick<Order, 'status' | 'fulfillment'>): { label: string; bg: string; color: string } {
  if (isPickup(order) && order.status === 'entregue') return { label: 'Retirado', bg: COLORS.successSoft, color: COLORS.success };
  return ORDERS_LIST_STATUS_BADGE[order.status];
}

/** "Pix", "Visa •••• 4242", "Pagar na retirada" ou "Dinheiro na entrega". */
export function orderPaymentLabel(order: Pick<Order, 'paymentMethod' | 'paymentDetail' | 'fulfillment'>): string {
  if (order.paymentMethod === 'dinheiro') return isPickup(order) ? 'Pagar na retirada' : 'Dinheiro na entrega';
  return order.paymentDetail ?? PAYMENT_LABELS[order.paymentMethod];
}

type PlaceOrderInput = Omit<
  Order,
  | 'id'
  | 'code'
  | 'status'
  | 'createdAt'
  | 'statusTimes'
  | 'reviewed'
  | 'reviewRating'
  | 'cancelledAt'
  | 'reservationId'
  | 'pickupDeadline'
  | 'cancelledByStore'
>;

type OrderContextValue = {
  orders: Order[];
  activeOrder: Order | null;
  /** Grava a reserva no Supabase (baixa o estoque) e só então cria o pedido. Rejeita com a mensagem do banco (ex.: esgotou). */
  placeOrder: (input: PlaceOrderInput) => Promise<Order>;
  markReviewed: (orderId: string, rating: 1 | 2 | 3 | 4 | 5) => void;
  /** Cancela a reserva no Supabase (devolve o estoque) e marca o pedido como cancelado. Rejeita se o banco recusar. */
  cancelOrder: (orderId: string) => Promise<void>;
  /** Removes an order that was never paid (e.g. the shopper backed out of the Pix screen). Unlike
   * `cancelOrder` it leaves no trace in the history — there's nothing to refund. */
  discardOrder: (orderId: string) => void;
};

const OrderContext = createContext<OrderContextValue | null>(null);

const uriOf = (image: unknown): string | null =>
  typeof image === 'object' && image !== null && 'uri' in image && typeof (image as { uri: unknown }).uri === 'string'
    ? (image as { uri: string }).uri
    : null;

/** Dados da empresa para guardar no pedido (só o que é serializável). */
export function snapshotMarket(market: Pick<Partner, 'name' | 'category' | 'address' | 'image' | 'lat' | 'lng'>): MarketSnapshot {
  return { name: market.name, category: market.category, address: market.address, imageUrl: uriOf(market.image), lat: market.lat, lng: market.lng };
}

/** Dados do produto para guardar na linha do pedido. */
export function snapshotLine(product: Pick<Product, 'id' | 'title' | 'unit' | 'image' | 'price'>, quantity: number): OrderLine {
  return { productId: product.id, quantity, unitPrice: product.price, title: product.title, unit: product.unit, imageUrl: uriOf(product.image) };
}

/** A empresa do pedido: a do catálogo atual, ou a cópia gravada na compra se ela já não está no catálogo. */
export function orderMarket(order: Pick<Order, 'marketId' | 'market'> | null | undefined): Partner | undefined {
  if (!order) return undefined;
  const live = getPartner(order.marketId);
  if (live) return live;
  const copy = order.market;
  if (!copy) return undefined;
  return {
    id: order.marketId,
    name: copy.name,
    kind: 'mercado',
    category: copy.category,
    address: copy.address,
    description: copy.category,
    image: copy.imageUrl ? { uri: copy.imageUrl } : FALLBACK_IMAGE,
    rating: 0,
    distanceKm: null,
    deliveryMinMinutes: 30,
    deliveryMaxMinutes: 45,
    deliveryFee: 0,
    freeDeliveryMinOrder: 0,
    featured: false,
    lat: copy.lat,
    lng: copy.lng,
    remote: true,
  };
}

/** O produto da linha: o do catálogo atual, ou a cópia gravada na compra. */
export function orderLineProduct(line: OrderLine, marketId: string): Product {
  const live = getProduct(line.productId);
  if (live) return live;
  return {
    id: line.productId,
    title: line.title ?? 'Produto indisponível',
    category: 'Outros',
    price: line.unitPrice,
    unit: line.unit ?? 'un',
    image: line.imageUrl ? { uri: line.imageUrl } : FALLBACK_IMAGE,
    marketId,
  };
}

const STATUS_STEPS: { delay: number; status: OrderStatus }[] = [
  { delay: 4000, status: 'preparando' },
  { delay: 9000, status: 'a_caminho' },
  { delay: 14000, status: 'entregue' },
];

/**
 * Etapas simuladas no aparelho: só para pedidos antigos, feitos antes de existir a reserva no banco. Nos outros, cada
 * etapa é a loja quem marca no web-empresa e o app lê do banco (applyServerState).
 */
function simulatedSteps(order: Pick<Order, 'fulfillment' | 'reservationId'>) {
  if (isPickup(order) || order.reservationId) return [];
  return STATUS_STEPS;
}

/** De quanto em quanto tempo o app pergunta ao banco em que etapa estão os pedidos em aberto. */
const SYNC_INTERVAL_MS = 10_000;

/** Ordem das etapas: o app só anda para frente (uma resposta antiga da rede nunca faz o pedido voltar). */
const STATUS_RANK: Record<OrderStatus, number> = { confirmado: 0, preparando: 1, pronto: 2, a_caminho: 2, entregue: 3, cancelado: 4 };

const parseTime = (iso: string | null, fallback: number) => {
  const time = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(time) ? fallback : time;
};

/** O pedido com a situação que está no banco (ou o mesmo objeto, se nada mudou). */
function applyServerState(order: Order, state: ReservationState, now: number): Order {
  if (order.status === 'cancelado') return order;
  if (state.status === 'cancelled' || state.status === 'expired' || state.status === 'no_show') {
    const at = parseTime(state.cancelledAt, now);
    return { ...order, status: 'cancelado', cancelledAt: at, cancelledByStore: true, statusTimes: { ...order.statusTimes, cancelado: at } };
  }

  const target: OrderStatus =
    state.status === 'picked_up'
      ? 'entregue'
      : state.stage === 'ready'
        ? 'pronto'
        : state.stage === 'out_for_delivery'
          ? 'a_caminho'
          : state.stage === 'preparing'
            ? 'preparando'
            : 'confirmado';
  if (STATUS_RANK[target] <= STATUS_RANK[order.status]) return order;

  // Hora de cada etapa como a loja marcou (as que ela pulou ficam sem hora).
  const statusTimes = { ...order.statusTimes };
  if (state.preparingAt) statusTimes.preparando ??= parseTime(state.preparingAt, now);
  if (state.readyAt) statusTimes.pronto ??= parseTime(state.readyAt, now);
  if (state.outForDeliveryAt) statusTimes.a_caminho ??= parseTime(state.outForDeliveryAt, now);
  if (target === 'entregue') statusTimes.entregue = parseTime(state.pickedUpAt, now);
  statusTimes[target] ??= now;
  return { ...order, status: target, statusTimes };
}

const storageKey = (userId: string) => `firestock-orders:${userId}`;

function isStoredOrder(value: unknown): value is Order {
  const o = value as Partial<Order> | null;
  return Boolean(
    o && typeof o.id === 'string' && typeof o.code === 'string' && typeof o.marketId === 'string' && Array.isArray(o.lines) && typeof o.createdAt === 'number' && typeof o.status === 'string'
  );
}

/** Ao reabrir o app, pedidos que ficaram "em andamento" avançam pelo tempo que passou, em vez de voltarem ao início. */
function catchUp(order: Order, now: number): Order {
  if (order.status === 'entregue' || order.status === 'cancelado') return order;
  let status: OrderStatus = order.status;
  const statusTimes = { ...order.statusTimes };
  for (const step of simulatedSteps(order)) {
    if (now - order.createdAt >= step.delay) {
      status = step.status;
      statusTimes[step.status] ??= order.createdAt + step.delay;
    }
  }
  return { ...order, status, statusTimes };
}

/** Código mostrado ao cliente: o código de retirada da reserva, que a empresa digita no web-empresa. */
function orderCode(pickupCode: string): string {
  return `FS-${pickupCode}`;
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const { userId } = useProfile();
  const [orders, setOrders] = useState<Order[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});

  useEffect(() => () => Object.values(timers.current).forEach((orderTimers) => orderTimers.forEach(clearTimeout)), []);

  // Same account-switch leak as cart-context.tsx: without this, a second person signing in on the same
  // device would see (and keep getting status updates for) the previous shopper's order history.
  const [hydratedFor, setHydratedFor] = useState('');

  // Carrega o histórico guardado no aparelho para esta conta (e nunca mostra o de outra pessoa).
  useEffect(() => {
    Object.values(timers.current).forEach((orderTimers) => orderTimers.forEach(clearTimeout));
    timers.current = {};
    setOrders([]);
    setHydratedFor('');
    if (!userId) return;
    let active = true;
    AsyncStorage.getItem(storageKey(userId))
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const stored = Array.isArray(parsed) ? parsed.filter(isStoredOrder) : [];
        const now = Date.now();
        const restored = stored.map((order) => catchUp(order, now));
        if (!active) return;
        setOrders(restored);
        // Pedidos ainda em andamento continuam a simulação de onde pararam.
        restored.forEach((order) => {
          if (order.status === 'entregue' || order.status === 'cancelado') return;
          timers.current[order.id] = simulatedSteps(order).filter((step) => now - order.createdAt < step.delay).map((step) =>
            setTimeout(() => advanceStatus(order.id, step.status), step.delay - (now - order.createdAt))
          );
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHydratedFor(userId);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Grava o histórico a cada mudança (só depois de carregar, para não apagar o que estava guardado).
  useEffect(() => {
    if (!userId || hydratedFor !== userId) return;
    AsyncStorage.setItem(storageKey(userId), JSON.stringify(orders)).catch(() => undefined);
  }, [orders, hydratedFor, userId]);

  // Versão mais recente dos pedidos para o sincronizador abaixo, que roda fora do ciclo de render.
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Busca no banco a situação dos pedidos em aberto: "Retirado"/"Entregue" quando a loja confirma no web-empresa,
  // "Cancelado" quando a loja cancela. Roda ao abrir, a cada SYNC_INTERVAL_MS e ao voltar para o app.
  useEffect(() => {
    if (!userId || hydratedFor !== userId) return;
    let active = true;
    const sync = async () => {
      const open = ordersRef.current.filter((order) => order.reservationId && order.status !== 'entregue' && order.status !== 'cancelado');
      if (open.length === 0) return;
      let states: ReservationState[];
      try {
        states = await reservationsService.fetchStates(open.map((order) => order.reservationId as string));
      } catch {
        return; // sem internet: tenta de novo no próximo ciclo
      }
      if (!active) return;
      const byId = new Map(states.map((state) => [state.id, state]));
      const now = Date.now();
      const changed = open.filter((order) => {
        const state = byId.get(order.reservationId as string);
        return state ? applyServerState(order, state, now) !== order : false;
      });
      if (changed.length === 0) return;
      changed.forEach((order) => {
        timers.current[order.id]?.forEach(clearTimeout);
        delete timers.current[order.id];
      });
      setOrders((current) =>
        current.map((order) => {
          const state = order.reservationId ? byId.get(order.reservationId) : undefined;
          return state ? applyServerState(order, state, now) : order;
        })
      );
    };
    sync();
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [userId, hydratedFor]);

  const advanceStatus = (orderId: string, status: OrderStatus) => {
    const now = Date.now();
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId && order.status !== 'cancelado'
          ? { ...order, status, statusTimes: { ...order.statusTimes, [status]: now } }
          : order
      )
    );
  };

  const placeOrder = async (input: PlaceOrderInput) => {
    const pickup = isPickup(input);
    const reservation = await reservationsService.createReservation({
      partnerId: input.marketId,
      lines: input.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      fulfillment: pickup ? 'pickup' : 'delivery',
      deliveryAddress: pickup ? undefined : input.address,
      paymentMethod: input.paymentMethod,
      deliveryFeeCents: pickup ? 0 : input.deliveryFee * 100,
      discountCents: input.discount * 100,
    });
    const now = Date.now();
    const id = reservation.id;
    const code = orderCode(reservation.pickupCode);

    const order: Order = {
      ...input,
      id,
      code,
      status: 'confirmado',
      createdAt: now,
      statusTimes: { confirmado: now },
      reviewed: false,
      reservationId: reservation.id,
      pickupDeadline: reservation.pickupDeadline ? parseTime(reservation.pickupDeadline, now) : undefined,
    };

    setOrders((current) => [order, ...current]);

    timers.current[id] = simulatedSteps(order).map(({ delay, status }) => setTimeout(() => advanceStatus(id, status), delay));

    return order;
  };

  const markReviewed = (orderId: string, rating: 1 | 2 | 3 | 4 | 5) => {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, reviewed: true, reviewRating: rating } : order))
    );
  };

  const cancelOrder = async (orderId: string) => {
    const reservationId = orders.find((order) => order.id === orderId)?.reservationId;
    if (reservationId) await reservationsService.cancelReservation(reservationId);
    timers.current[orderId]?.forEach(clearTimeout);
    delete timers.current[orderId];
    const now = Date.now();
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? { ...order, status: 'cancelado', cancelledAt: now, statusTimes: { ...order.statusTimes, cancelado: now } }
          : order
      )
    );
  };

  const discardOrder = (orderId: string) => {
    // O Pix não foi pago: libera o estoque reservado. Se a rede falhar aqui, a reserva fica em aberto no banco.
    const reservationId = orders.find((order) => order.id === orderId)?.reservationId;
    if (reservationId) reservationsService.cancelReservation(reservationId).catch(() => undefined);
    timers.current[orderId]?.forEach(clearTimeout);
    delete timers.current[orderId];
    setOrders((current) => current.filter((order) => order.id !== orderId));
  };

  const activeOrder = orders.find((order) => order.status !== 'entregue' && order.status !== 'cancelado') ?? null;

  return (
    <OrderContext.Provider value={{ orders, activeOrder, placeOrder, markReviewed, cancelOrder, discardOrder }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
}
