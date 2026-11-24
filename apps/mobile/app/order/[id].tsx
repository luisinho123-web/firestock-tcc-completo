import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import {
  DELIVERY_META,
  isPickup,
  orderLineProduct,
  orderMarket,
  orderPaymentLabel,
  orderStatusBadge,
  useOrders,
} from '@/contexts/order-context';
import type { Product } from '@/data/products';
import { useGuardedAddToCart } from '@/hooks/use-guarded-add-to-cart';
import { formatCurrency } from '@/utils/currency';
import { formatShortDate } from '@/utils/date';
import { pluralize } from '@/utils/format';

export default function OrderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders } = useOrders();
  const { addLinesToCart, modal } = useGuardedAddToCart();

  const order = orders.find((item) => item.id === id);
  const market = orderMarket(order);

  if (!order || !market) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + SPACING.md }]}>
        <ScreenContainer style={styles.notFoundContainer}>
          <ScreenHeader title="Pedido" />
          <EmptyState icon="shippingbox.fill" title="Pedido não encontrado" subtitle="Esse pedido pode não existir mais." />
        </ScreenContainer>
      </View>
    );
  }

  const lines: { line: (typeof order.lines)[number]; product: Product }[] = [];
  for (const line of order.lines) {
    lines.push({ line, product: orderLineProduct(line, order.marketId) });
  }

  const totalItems = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const badge = orderStatusBadge(order);
  const pickup = isPickup(order);
  const isActive = order.status !== 'entregue' && order.status !== 'cancelado';

  const handleReorder = () => {
    const added = addLinesToCart(
      order.lines.map((line) => ({ id: line.productId, quantity: line.quantity })),
      'os itens desse pedido'
    );
    if (added) router.dismissTo('/cart');
  };

  return (
    <View style={styles.page}>
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.md }]}
          showsVerticalScrollIndicator={false}>
          <ScreenHeader title={`Pedido #${order.code}`} style={styles.header} />

          <View style={styles.statusCard}>
            <Image source={market.image} style={styles.statusImage} contentFit="cover" />
            <View style={styles.statusInfo}>
              <Text style={styles.statusName}>{market.name}</Text>
              <View style={styles.statusMetaRow}>
                {order.status === 'entregue' ? (
                  <IconSymbol name="checkmark.circle.fill" size={13} color={COLORS.textTertiary} />
                ) : null}
                <Text style={styles.statusMetaText}>
                  {formatShortDate(new Date(order.createdAt))} · {order.address}
                </Text>
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          {order.status === 'entregue' && !order.reviewed ? (
            <PressableScale
              style={styles.ratePrompt}
              onPress={() => router.push({ pathname: '/review/[orderId]', params: { orderId: order.id } })}
              accessibilityRole="button">
              <View style={styles.ratePromptInfo}>
                <Text style={styles.ratePromptTitle}>Como foi esse pedido?</Text>
                <View style={styles.ratePromptStars}>
                  {[1, 2, 3, 4, 5].map((position) => (
                    <IconSymbol key={position} name="star" size={20} color={COLORS.warning} />
                  ))}
                </View>
              </View>
              <View style={styles.rateButton}>
                <Text style={styles.rateButtonText}>Avaliar</Text>
              </View>
            </PressableScale>
          ) : null}

          <View style={styles.itemsCard}>
            <View style={styles.itemsHeaderRow}>
              <Text style={styles.sectionTitle}>Itens do pedido</Text>
              <Text style={styles.itemsCount}>{pluralize(totalItems, 'item', 'itens')}</Text>
            </View>

            {lines.map(({ line, product }) => (
              <View key={line.productId} style={styles.itemRow}>
                <View style={styles.itemMedia}>
                  <Image source={product.image} style={styles.itemImage} contentFit="contain" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{product.title}</Text>
                  <Text style={styles.itemQuantity}>
                    {line.quantity} {product.unit} × {formatCurrency(line.unitPrice)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{formatCurrency(line.unitPrice * line.quantity)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrency(order.subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{pickup ? 'Retirada no local' : `Entrega (${DELIVERY_META[order.deliveryOption].label})`}</Text>
              <Text style={[styles.summaryValue, order.deliveryFee === 0 && styles.summaryValueGreen]}>
                {order.deliveryFee === 0 ? 'Grátis' : formatCurrency(order.deliveryFee)}
              </Text>
            </View>
            {order.discount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Desconto</Text>
                <Text style={[styles.summaryValue, styles.summaryValueGreen]}>– {formatCurrency(order.discount)}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pagamento</Text>
              <Text style={styles.summaryValue}>{orderPaymentLabel(order)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrency(order.total)}</Text>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>

      <BottomBar style={styles.ctaRow}>
        <Button
          label="Ajuda"
          icon="questionmark.circle.fill"
          variant="secondary"
          onPress={() => router.push('/support')}
          style={styles.helpButton}
        />
        {isActive ? (
          <Button
            label={pickup ? 'Ver código' : 'Acompanhar'}
            icon={pickup ? 'storefront.fill' : 'truck.fill'}
            onPress={() => router.push({ pathname: '/order-tracking', params: { id: order.id } })}
            style={styles.primaryButton}
          />
        ) : (
          <Button label="Pedir de novo" icon="cart.fill" onPress={handleReorder} style={styles.primaryButton} />
        )}
      </BottomBar>

      {modal}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    marginBottom: SPACING.xs,
  },
  notFoundContainer: {
    paddingHorizontal: SPACING.lg,
  },
  ctaRow: {
    flexDirection: 'row',
  },
  helpButton: {
    flex: 1,
    width: 'auto',
    paddingHorizontal: SPACING.sm,
  },
  primaryButton: {
    flex: 2,
    width: 'auto',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 14,
  },
  statusImage: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  statusInfo: {
    flex: 1,
    gap: 3,
  },
  statusName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  statusMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusMetaText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  badgeText: {
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  ratePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFEEE6',
    borderRadius: RADIUS.large,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ratePromptInfo: {
    flex: 1,
    gap: 6,
  },
  ratePromptTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  ratePromptStars: {
    flexDirection: 'row',
    gap: 4,
  },
  rateButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateButtonText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  itemsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 16,
    gap: 12,
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.bold,
  },
  itemsCount: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemMedia: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: '75%',
    height: '75%',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  itemQuantity: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  itemTotal: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 16,
    gap: 10,
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
  summaryValueGreen: {
    color: COLORS.success,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  summaryTotalLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.bold,
  },
  summaryTotalValue: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: FONT_WEIGHTS.heavy,
  },
});
