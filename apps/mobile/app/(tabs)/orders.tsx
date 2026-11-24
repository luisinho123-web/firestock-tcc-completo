import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StarRating } from '@/components/ui/star-rating';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING, TYPOGRAPHY } from '@/components/ui/theme';
import {
  STATUS_ETA_MINUTES,
  STATUS_PROGRESS,
  formatPickupDeadline,
  isPickup,
  orderMarket,
  orderStatusBadge,
  useOrders,
  type Order,
} from '@/contexts/order-context';
import { useGuardedAddToCart } from '@/hooks/use-guarded-add-to-cart';
import { formatCurrency } from '@/utils/currency';
import { formatShortDate } from '@/utils/date';
import { pluralize } from '@/utils/format';
import { useCatalogVersion } from '@/contexts/catalog-context';

type Tab = 'andamento' | 'concluidos' | 'cancelados';

const EMPTY_COPY: Record<Tab, string> = {
  andamento: 'Seus pedidos em andamento vão aparecer aqui.',
  concluidos: 'Pedidos entregues vão aparecer aqui.',
  cancelados: 'Pedidos cancelados vão aparecer aqui.',
};

export default function OrdersScreen() {
  useCatalogVersion();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const { addLinesToCart, modal } = useGuardedAddToCart();
  const [tab, setTab] = useState<Tab>('andamento');

  const grouped: Record<Tab, Order[]> = {
    andamento: orders.filter((order) => order.status !== 'entregue' && order.status !== 'cancelado'),
    concluidos: orders.filter((order) => order.status === 'entregue'),
    cancelados: orders.filter((order) => order.status === 'cancelado'),
  };

  const handleReorder = (order: Order) => {
    const added = addLinesToCart(
      order.lines.map((line) => ({ id: line.productId, quantity: line.quantity })),
      'os itens desse pedido'
    );
    if (added) router.navigate('/cart');
  };

  const list = grouped[tab];

  return (
    <View style={styles.page}>
      <ScreenContainer style={[styles.screenContainer, { paddingTop: insets.top + SPACING.md }]}>
        <Text style={styles.title} accessibilityRole="header">
          Meus pedidos
        </Text>

        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { key: 'andamento', label: 'Em andamento', count: grouped.andamento.length },
            { key: 'concluidos', label: 'Concluídos', count: grouped.concluidos.length },
            { key: 'cancelados', label: 'Cancelados', count: grouped.cancelados.length },
          ]}
        />

        {list.length === 0 ? (
          <EmptyState
            icon="shippingbox.fill"
            title="Nada por aqui ainda"
            subtitle={EMPTY_COPY[tab]}
            actionLabel={tab === 'andamento' ? 'Ver mercados' : undefined}
            onAction={tab === 'andamento' ? () => router.navigate('/markets') : undefined}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {list.map((order) => {
              const market = orderMarket(order);
              if (!market) return null;
              const totalItems = order.lines.reduce((sum, line) => sum + line.quantity, 0);
              const badge = orderStatusBadge(order);
              const pickup = isPickup(order);
              const progress = STATUS_PROGRESS[order.status];
              const etaText = pickup
                ? order.status === 'pronto'
                  ? 'Pronto! Pode retirar'
                  : `Retire até ${formatPickupDeadline(order.pickupDeadline)}`
                : `Chega em ${STATUS_ETA_MINUTES[order.status]} min`;

              if (tab === 'andamento') {
                return (
                  <PressableScale
                    key={order.id}
                    style={styles.activeCard}
                    onPress={() => router.push({ pathname: '/order-tracking', params: { id: order.id } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Pedido ${order.code} no ${market.name}, ${badge.label}, ${etaText}`}
                    accessibilityHint={pickup ? 'Abre o código de retirada' : 'Abre o acompanhamento da entrega'}>
                    <View style={styles.activeCardTopRow}>
                      <Image source={market.image} style={styles.activeCardImage} contentFit="cover" />
                      <View style={styles.activeCardInfo}>
                        <Text style={styles.activeCardName}>{market.name}</Text>
                        <Text style={styles.activeCardDetail}>
                          #{order.code} · {pluralize(totalItems, 'item', 'itens')} · {formatCurrency(order.total)}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                    </View>

                    <View style={styles.progressRow}>
                      {[0, 1, 2, 3].map((segment) => (
                        <View
                          key={segment}
                          style={[
                            styles.progressSegment,
                            segment < progress && { backgroundColor: badge.color },
                          ]}
                        />
                      ))}
                    </View>

                    <View style={styles.activeCardBottomRow}>
                      <View style={styles.activeCardEtaRow}>
                        <IconSymbol name="clock.fill" size={16} color={COLORS.navy} />
                        <Text style={styles.activeCardEtaText}>{etaText}</Text>
                      </View>
                      <View style={styles.trackButton}>
                        <IconSymbol name={pickup ? 'storefront.fill' : 'truck.fill'} size={16} color={COLORS.navy} />
                        <Text style={styles.trackButtonText}>{pickup ? 'Ver código' : 'Acompanhar'}</Text>
                      </View>
                    </View>
                  </PressableScale>
                );
              }

              return (
                <View key={order.id} style={styles.historyCard}>
                  <PressableScale
                    style={styles.historyTopRow}
                    onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
                    accessibilityRole="button"
                    accessibilityHint="Abre os detalhes do pedido">
                    <Image source={market.image} style={styles.historyImage} contentFit="cover" />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyName}>{market.name}</Text>
                      <View style={styles.historyStatusRow}>
                        {tab === 'concluidos' ? (
                          <IconSymbol name="checkmark.circle.fill" size={12} color={COLORS.success} />
                        ) : null}
                        <Text style={styles.historyStatusText}>
                          {badge.label} · {formatShortDate(new Date(order.createdAt))} · {pluralize(totalItems, 'item', 'itens')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.historyTotal}>{formatCurrency(order.total)}</Text>
                  </PressableScale>

                  <View style={styles.historyDivider} />
                  <View style={styles.historyBottomRow}>
                    {tab === 'concluidos' ? (
                      order.reviewed && order.reviewRating ? (
                        <StarRating rating={order.reviewRating} />
                      ) : (
                        <PressableScale
                          style={styles.reviewLink}
                          onPress={() => router.push({ pathname: '/review/[orderId]', params: { orderId: order.id } })}
                          hitSlop={8}
                          accessibilityRole="button">
                          <IconSymbol name="star.fill" size={16} color={COLORS.orange} />
                          <Text style={styles.reviewLinkText}>Avaliar pedido</Text>
                        </PressableScale>
                      )
                    ) : (
                      <View />
                    )}
                    <PressableScale style={styles.reorderButton} onPress={() => handleReorder(order)} accessibilityRole="button">
                      <Text style={styles.reorderButtonText}>Pedir de novo</Text>
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </ScreenContainer>

      {modal}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.pageTitle,
  },
  scrollContent: {
    gap: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  activeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 16,
    gap: 14,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  activeCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeCardImage: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  activeCardInfo: {
    flex: 1,
    gap: 2,
  },
  activeCardName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.bold,
  },
  activeCardDetail: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  badgeText: {
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  activeCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeCardEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeCardEtaText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
  },
  trackButtonText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 14,
    gap: 12,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyImage: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  historyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyStatusText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  historyTotal: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  historyDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  historyBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewLinkText: {
    color: COLORS.orange,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  reorderButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
