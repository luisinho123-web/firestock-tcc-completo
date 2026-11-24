import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenContainer } from '@/components/ui/screen-container';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import {
  DELIVERY_META,
  formatEtaWindow,
  formatPickupDeadline,
  isPickup,
  orderMarket,
  orderPaymentLabel,
  useOrders,
  type PaymentKey,
} from '@/contexts/order-context';
import { formatCurrency } from '@/utils/currency';
import { pluralize } from '@/utils/format';

const PAYMENT_ICON: Record<PaymentKey, number> = {
  pix: require('@/assets/icons/payment/pix.png'),
  cartao: require('@/assets/icons/payment/cartao.png'),
  dinheiro: require('@/assets/icons/payment/dinheiro.png'),
};

/** Positions are percentages of the celebration area so the confetti frames the badge on any width. */
const CONFETTI = [
  { top: '14%', left: '14%', rotate: '-27deg', color: COLORS.orange },
  { top: '20%', left: '82%', rotate: '-18deg', color: COLORS.accent },
  { top: '78%', left: '18%', rotate: '36deg', color: COLORS.accent },
  { top: '72%', left: '80%', rotate: '-54deg', color: COLORS.orange },
  { top: '44%', left: '6%', rotate: '-81deg', color: COLORS.navy },
  { top: '48%', left: '90%', rotate: '-9deg', color: COLORS.success },
  { top: '6%', left: '34%', rotate: '54deg', color: COLORS.success },
  { top: '2%', left: '64%', rotate: '-36deg', color: COLORS.navy },
] as const;

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders } = useOrders();

  const order = orders.find((item) => item.id === id);
  const market = orderMarket(order);

  if (!order || !market) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + SPACING.xl }]}>
        <EmptyState
          icon="shippingbox.fill"
          title="Pedido não encontrado"
          subtitle="Esse pedido pode não existir mais."
          actionLabel="Ver meus pedidos"
          onAction={() => router.dismissTo('/orders')}
        />
      </View>
    );
  }

  const totalItems = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const paidOnDelivery = order.paymentMethod === 'dinheiro';
  const paymentLabel = orderPaymentLabel(order);
  const pickup = isPickup(order);
  const intro = pickup
    ? `${paidOnDelivery ? 'Pague na retirada. ' : 'Pagamento aprovado! '}Sua reserva #${order.code} no ${market.name} está garantida. Mostre esse código no balcão para retirar.`
    : `${paidOnDelivery ? 'Pague na entrega. ' : 'Pagamento aprovado! '}O pedido #${order.code} foi enviado ao ${market.name} — a separação começa assim que a loja aceitar.`;

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.xl }]}
        showsVerticalScrollIndicator={false}>
        <ScreenContainer fill={false} style={styles.content}>
          <View style={styles.celebration}>
            {CONFETTI.map((piece, index) => (
              <View
                key={index}
                style={[
                  styles.confetti,
                  { top: piece.top, left: piece.left, backgroundColor: piece.color, transform: [{ rotate: piece.rotate }] },
                ]}
              />
            ))}
            <View style={styles.successRingOuter}>
              <View style={styles.successRingInner}>
                <View style={styles.successCircle}>
                  <IconSymbol name="checkmark" size={48} color={COLORS.onDark} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.textStack} accessible accessibilityLiveRegion="polite">
            <Text style={styles.title} accessibilityRole="header">
              Pedido confirmado!
            </Text>
            <Text style={styles.subtitle}>{intro}</Text>
          </View>

          <View style={styles.etaCard}>
            <View style={styles.etaIcon}>
              <IconSymbol name="clock.fill" size={20} color={COLORS.onDark} />
            </View>
            <View style={styles.etaInfo}>
              <Text style={styles.etaLabel}>{pickup ? 'Retire até' : 'Previsão de entrega'}</Text>
              <Text style={styles.etaValue}>
                {pickup ? formatPickupDeadline(order.pickupDeadline) : formatEtaWindow(order)}
              </Text>
            </View>
            <View style={styles.etaBadge}>
              <Text style={styles.etaBadgeText}>{pickup ? 'Retirada' : DELIVERY_META[order.deliveryOption].label}</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryStoreRow}>
              <Image source={market.image} style={styles.summaryStoreImage} contentFit="cover" />
              <View style={styles.summaryStoreInfo}>
                <Text style={styles.summaryStoreName}>{market.name}</Text>
                <Text style={styles.summaryStoreDetail} numberOfLines={2}>
                  {pluralize(totalItems, 'item', 'itens')} · {order.address}
                </Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pagamento</Text>
              <View style={styles.summaryPaymentRow}>
                <Image source={PAYMENT_ICON[order.paymentMethod]} style={styles.summaryPaymentIcon} contentFit="contain" />
                <Text style={styles.summaryValue}>{paymentLabel}</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{paidOnDelivery ? 'Total a pagar' : 'Total pago'}</Text>
              <Text style={styles.summaryTotal}>{formatCurrency(order.total)}</Text>
            </View>
          </View>
        </ScreenContainer>
      </ScrollView>

      <BottomBar elevated={false}>
        <Button
          label="Acompanhar pedido"
          icon={pickup ? 'storefront.fill' : 'truck.fill'}
          onPress={() => router.replace({ pathname: '/order-tracking', params: { id: order.id } })}
        />
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
  confetti: {
    position: 'absolute',
    width: 14,
    height: 6,
    borderRadius: 3,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  content: {
    alignItems: 'center',
    gap: SPACING.lg,
  },
  celebration: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  successRingOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRingInner: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStack: {
    gap: 10,
    alignItems: 'center',
  },
  title: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.hero,
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
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.large,
    padding: 16,
  },
  etaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaInfo: {
    flex: 1,
    gap: 2,
  },
  etaLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FONT_SIZES.small,
  },
  etaValue: {
    color: COLORS.onDark,
    fontSize: 17,
    fontWeight: FONT_WEIGHTS.bold,
  },
  etaBadge: {
    backgroundColor: '#A7B0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  etaBadgeText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
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
  summaryStoreInfo: {
    flex: 1,
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
  summaryPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryPaymentIcon: {
    width: 16,
    height: 16,
  },
  summaryValue: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  summaryTotal: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: FONT_WEIGHTS.heavy,
  },
});
