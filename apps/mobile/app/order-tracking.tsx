import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PickupView } from '@/components/order-tracking/pickup-view';
import { TrackingMap } from '@/components/order-tracking/tracking-map';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { COURIER_NAMES } from '@/contexts/notifications-context';
import {
  PAYMENT_LABELS,
  STATUS_ETA_MINUTES,
  formatClock,
  isPickup,
  orderPaymentLabel,
  useOrders,
  type Order,
  type OrderStatus,
  orderMarket,
} from '@/contexts/order-context';
import type { Partner } from '@/data/partners';
import { errorMessage } from '@/services/auth';
import { formatCurrency } from '@/utils/currency';
import { pluralize } from '@/utils/format';
import { seededPick } from '@/utils/seeded';

/** How far along the road route the courier marker sits for each status (0 = at the store, 1 = at the door). */
const COURIER_ROUTE_PROGRESS: Record<OrderStatus, number> = {
  confirmado: 0,
  preparando: 0,
  pronto: 0,
  a_caminho: 0.55,
  entregue: 1,
  cancelado: 0,
};

const TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'confirmado', label: 'Pedido recebido' },
  { status: 'preparando', label: 'Separando os produtos' },
  { status: 'a_caminho', label: 'Pedido a caminho' },
  { status: 'entregue', label: 'Pedido entregue' },
];

const STATUS_BADGE: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  confirmado: { label: 'Pedido recebido', bg: COLORS.primarySoft, color: COLORS.navy },
  preparando: { label: 'Separando os produtos', bg: COLORS.primarySoft, color: COLORS.navy },
  pronto: { label: 'Pronto', bg: COLORS.successSoft, color: COLORS.success },
  a_caminho: { label: 'Pedido a caminho', bg: COLORS.orangeSoft, color: COLORS.orange },
  entregue: { label: 'Pedido entregue', bg: COLORS.successSoft, color: COLORS.success },
  cancelado: { label: 'Cancelado', bg: COLORS.errorSoft, color: COLORS.error },
};

export default function OrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeOrder, orders } = useOrders();

  const order = (id ? orders.find((item) => item.id === id) : null) ?? activeOrder ?? orders[0] ?? null;
  const market = orderMarket(order);

  if (!order || !market) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + SPACING.md }]}>
        <ScreenContainer style={styles.notFoundContainer}>
          <ScreenHeader title="Acompanhar pedido" />
          <EmptyState
            icon="shippingbox.fill"
            title="Nenhum pedido em andamento"
            subtitle="Faça um pedido em um mercado parceiro para acompanhar a entrega aqui."
            actionLabel="Ver mercados"
            onAction={() => router.dismissTo('/markets')}
          />
        </ScreenContainer>
      </View>
    );
  }

  if (order.status === 'cancelado') {
    return <CancelledView order={order} market={market} />;
  }

  if (isPickup(order)) {
    return <PickupView order={order} market={market} />;
  }

  return <TrackingView order={order} market={market} />;
}

function TrackingView({ order, market }: { order: Order; market: Partner }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { cancelOrder } = useOrders();
  const currentIndex = TIMELINE_STEPS.findIndex((step) => step.status === order.status);
  const badge = STATUS_BADGE[order.status];
  const etaMinutes = STATUS_ETA_MINUTES[order.status];
  const delivered = order.status === 'entregue';
  // Anchored to when the order entered its current status, so the estimate is stable between renders.
  const currentSince = order.statusTimes[order.status] ?? order.createdAt;
  const etaClock = formatClock(new Date(currentSince + etaMinutes * 60000));
  const courierName = seededPick(order.code, COURIER_NAMES);
  // The map takes a bit over a third of the screen, leaving the details sheet room on small phones.
  const mapHeight = Math.round(Math.min(320, Math.max(220, height * 0.36)));

  const handleCancel = () => {
    const refundCopy =
      order.paymentMethod === 'dinheiro' ? 'Nada será cobrado.' : `O valor volta via ${PAYMENT_LABELS[order.paymentMethod]}.`;
    Alert.alert('Cancelar pedido?', `Isso cancela o pedido #${order.code}. ${refundCopy}`, [
      { text: 'Manter pedido', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: () => {
          cancelOrder(order.id).catch((error) => Alert.alert('Não foi possível cancelar', errorMessage(error)));
        },
      },
    ]);
  };

  return (
    <View style={styles.page}>
      <TrackingMap
        config={{
          store: { lat: market.lat, lng: market.lng },
          home: { lat: order.addressLat, lng: order.addressLng },
          progress: COURIER_ROUTE_PROGRESS[order.status],
        }}
        style={[styles.map, { height: mapHeight + insets.top }]}
      />

      <View style={[styles.floatingActions, { top: insets.top + SPACING.sm }]}>
        <IconButton
          icon="chevron.left"
          accessibilityLabel="Voltar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))}
        />
        <View style={styles.orderCodePill}>
          <Text style={styles.orderCodeText}>Pedido #{order.code}</Text>
        </View>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xs }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.sheetHandle} />

        <View style={styles.etaRow} accessible accessibilityLiveRegion="polite">
          <View>
            <Text style={styles.etaLabel}>{delivered ? 'Entregue às' : 'Chega em'}</Text>
            <Text style={styles.etaValue}>
              {delivered ? formatClock(new Date(order.statusTimes.entregue ?? currentSince)) : `${etaMinutes} min`}
            </Text>
            {!delivered ? <Text style={styles.etaLabel}>Previsão: {etaClock}</Text> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <IconSymbol name="location.fill" size={14} color={COLORS.textTertiary} />
          <Text style={styles.addressText} numberOfLines={2}>
            {order.address}
          </Text>
        </View>

        {order.reservationId && !delivered ? (
          <Text style={styles.addressText}>A loja atualiza cada etapa e esta tela muda sozinha.</Text>
        ) : null}

        <View style={styles.timeline} accessibilityRole="list">
          {TIMELINE_STEPS.map((step, index) => {
            const reachedAt = order.statusTimes[step.status];
            const done = index < currentIndex || (delivered && index === currentIndex);
            const current = index === currentIndex && !delivered;
            const isLast = index === TIMELINE_STEPS.length - 1;
            const timeLabel = reachedAt
              ? formatClock(new Date(reachedAt))
              : step.status === 'entregue'
              ? `Previsto para ${etaClock}`
              : '';
            return (
              <View
                key={step.status}
                style={styles.timelineStep}
                accessible
                accessibilityLabel={`${step.label}: ${done ? 'concluído' : current ? 'em andamento' : 'pendente'}${
                  timeLabel ? `, ${timeLabel}` : ''
                }`}>
                <View style={styles.timelineMarkerColumn}>
                  <View style={[styles.timelineDot, done && styles.timelineDotDone, current && styles.timelineDotCurrent]}>
                    {done ? <IconSymbol name="checkmark" size={14} color={COLORS.onDark} /> : null}
                  </View>
                  {!isLast ? <View style={[styles.timelineLine, (done || current) && styles.timelineLineDone]} /> : null}
                </View>
                <View style={styles.timelineTextStack}>
                  <Text style={[styles.timelineLabel, !done && !current && styles.timelineLabelPending]}>{step.label}</Text>
                  <Text style={styles.timelineTime}>{timeLabel}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.courierCard}>
          <Image source={market.image} style={styles.courierImage} contentFit="cover" />
          <View style={styles.courierInfo}>
            {/* Pedidos com reserva no banco são entregues pela própria loja; o nome de entregador é só da simulação antiga. */}
            <Text style={styles.courierName}>{order.reservationId ? market.name : courierName}</Text>
            <Text style={styles.courierRole}>{order.reservationId ? 'Entrega feita pela loja' : `Entregador do ${market.name}`}</Text>
          </View>
          <IconButton
            icon="questionmark.circle.fill"
            size={42}
            accessibilityLabel="Ajuda com este pedido"
            onPress={() => router.push('/support')}
          />
        </View>

        {delivered ? (
          <Button
            label={order.reviewed ? 'Ver detalhes do pedido' : 'Avaliar pedido'}
            icon={order.reviewed ? undefined : 'star.fill'}
            onPress={() =>
              order.reviewed
                ? router.replace({ pathname: '/order/[id]', params: { id: order.id } })
                : router.push({ pathname: '/review/[orderId]', params: { orderId: order.id } })
            }
          />
        ) : order.status === 'a_caminho' && order.reservationId ? (
          // O banco não deixa o cliente cancelar depois que a loja marcou "a caminho".
          <Text style={[styles.addressText, styles.centerNote]}>O pedido já saiu para entrega e não pode mais ser cancelado.</Text>
        ) : (
          <PressableScale style={styles.cancelButton} onPress={handleCancel} accessibilityRole="button">
            <Text style={styles.cancelButtonText}>Cancelar pedido</Text>
          </PressableScale>
        )}
      </ScrollView>
    </View>
  );
}

function CancelledView({ order, market }: { order: Order; market: Partner }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const canceledAtClock = formatClock(new Date(order.cancelledAt ?? order.createdAt));
  const paidOnDelivery = order.paymentMethod === 'dinheiro';
  const byStore = Boolean(order.cancelledByStore);
  const kind = isPickup(order) ? 'a reserva' : 'o pedido';

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.cancelledScroll, { paddingTop: insets.top + SPACING.xxl }]}
        showsVerticalScrollIndicator={false}>
        <ScreenContainer fill={false} style={styles.cancelledContent}>
          <View style={styles.cancelledRingOuter}>
            <View style={styles.cancelledRingInner}>
              <IconSymbol name="xmark" size={42} color={COLORS.onDark} />
            </View>
          </View>

          <View style={styles.textStack}>
            <Text style={styles.title} accessibilityRole="header">
              {isPickup(order) ? 'Reserva cancelada' : 'Pedido cancelado'}
            </Text>
            <Text style={styles.subtitle}>
              {byStore ? `O ${market.name} cancelou ${kind} #${order.code}.` : `Você cancelou ${kind} #${order.code} no ${market.name}.`}
            </Text>
          </View>

          {paidOnDelivery ? null : (
            <View style={styles.refundCard}>
              <View style={styles.refundIcon}>
                <IconSymbol name="checkmark" size={22} color={COLORS.onDark} />
              </View>
              <View style={styles.refundInfo}>
                <Text style={styles.refundTitle}>Reembolso de {formatCurrency(order.total)}</Text>
                <Text style={styles.refundSubtitle}>Devolvido via {PAYMENT_LABELS[order.paymentMethod]} em até 1 hora</Text>
              </View>
            </View>
          )}

          <View style={styles.summaryCard}>
            <View style={styles.summaryStoreRow}>
              <Image source={market.image} style={styles.summaryStoreImage} contentFit="cover" />
              <View>
                <Text style={styles.summaryStoreName}>{market.name}</Text>
                <Text style={styles.summaryStoreDetail}>
                  {pluralize(
                    order.lines.reduce((sum, line) => sum + line.quantity, 0),
                    'item',
                    'itens'
                  )}{' '}
                  · {orderPaymentLabel(order)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cancelado por</Text>
              <Text style={styles.summaryValue}>{byStore ? 'Loja' : 'Você'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cancelado em</Text>
              <Text style={styles.summaryValue}>Hoje, {canceledAtClock}</Text>
            </View>
          </View>
        </ScreenContainer>
      </ScrollView>

      <BottomBar elevated={false}>
        <Button label="Encontrar em outro mercado" icon="storefront.fill" onPress={() => router.dismissTo('/markets')} />
        <Button label="Voltar para o início" variant="ghost" onPress={() => router.dismissTo('/home')} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  notFoundContainer: {
    paddingHorizontal: SPACING.lg,
  },
  map: {
    backgroundColor: COLORS.background,
  },
  floatingActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconSpacer: {
    width: 44,
    height: 44,
  },
  orderCodePill: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.navy,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  orderCodeText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  sheet: {
    marginTop: -RADIUS.xl,
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  sheetContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  etaLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  etaValue: {
    color: COLORS.navy,
    fontSize: 32,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  statusBadgeText: {
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    flex: 1,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    lineHeight: 17,
  },
  timeline: {
    gap: 0,
  },
  timelineStep: {
    flexDirection: 'row',
    gap: 14,
  },
  timelineMarkerColumn: {
    width: 26,
    alignItems: 'center',
  },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  timelineDotCurrent: {
    borderColor: COLORS.orange,
    borderWidth: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 26,
    backgroundColor: COLORS.border,
  },
  timelineLineDone: {
    backgroundColor: COLORS.navy,
  },
  timelineTextStack: {
    flex: 1,
    paddingBottom: 12,
    paddingTop: 2,
    gap: 2,
  },
  timelineLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  timelineLabelPending: {
    color: COLORS.textFaint,
  },
  timelineTime: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  courierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.large,
    padding: 12,
    marginBottom: SPACING.md,
  },
  courierImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  courierInfo: {
    flex: 1,
    gap: 2,
  },
  courierName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  courierRole: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  centerNote: {
    textAlign: 'center',
    paddingVertical: SPACING.sm,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
  },
  cancelledScroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  cancelledContent: {
    alignItems: 'center',
    gap: SPACING.lg,
  },
  cancelledRingOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: COLORS.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledRingInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStack: {
    gap: 10,
    alignItems: 'center',
  },
  title: {
    color: COLORS.navy,
    fontSize: 30,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textTertiary,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  refundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    backgroundColor: COLORS.successSoft,
    borderRadius: RADIUS.large,
    padding: 16,
  },
  refundIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refundInfo: {
    flex: 1,
    gap: 2,
  },
  refundTitle: {
    color: COLORS.success,
    fontSize: 17,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  refundSubtitle: {
    color: 'rgba(0,8,81,0.75)',
    fontSize: FONT_SIZES.small,
    lineHeight: 18,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.large,
    padding: 16,
    gap: 12,
  },
  summaryStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryStoreImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  summaryStoreName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  summaryStoreDetail: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.body,
  },
  summaryValue: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
