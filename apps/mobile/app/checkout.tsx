import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING, TYPOGRAPHY } from '@/components/ui/theme';
import { useAddresses } from '@/contexts/addresses-context';
import { useCart } from '@/contexts/cart-context';
import { useCatalog } from '@/contexts/catalog-context';
import {
  EXPRESS_DELIVERY,
  FULFILLMENT_LABELS,
  PICKUP_WINDOW_HOURS,
  snapshotLine,
  snapshotMarket,
  useOrders,
  type DeliveryOptionKey,
  type Fulfillment,
  type PaymentKey,
} from '@/contexts/order-context';
import { usePaymentMethods, type PaymentMethod } from '@/contexts/payment-methods-context';
import { deliveryFeeFor } from '@/data/partners';
import { useCartSummary } from '@/hooks/use-cart-summary';
import { errorMessage } from '@/services/auth';
import { formatCurrency } from '@/utils/currency';
import { formatMinutesRange, pluralize } from '@/utils/format';

type DeliveryOption = {
  key: DeliveryOptionKey;
  label: string;
  eta: string;
  fee: number;
  etaMin: number;
  etaMax: number;
  icon: IconSymbolName;
};

const PAYMENT_ICONS: Record<PaymentKey, number> = {
  pix: require('@/assets/icons/payment/pix.png'),
  cartao: require('@/assets/icons/payment/cartao.png'),
  dinheiro: require('@/assets/icons/payment/dinheiro.png'),
};

type SavedCard = Extract<PaymentMethod, { type: 'cartao' }>;

function cardLabel(card: SavedCard): string {
  return `${card.brand === 'visa' ? 'Visa' : 'Mastercard'} •••• ${card.last4}`;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { removeCoupon, clearCart } = useCart();
  const { lines, market, itemCount, subtotal, discount, appliedCoupon } = useCartSummary();
  const { placeOrder } = useOrders();
  const { refresh: refreshCatalog } = useCatalog();
  const { selectedAddress: address } = useAddresses();
  const { methods, selectedMethod, selectMethod } = usePaymentMethods();
  const [fulfillment, setFulfillment] = useState<Fulfillment>('retirada');
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOptionKey>('padrao');
  const [isPlacing, setIsPlacing] = useState(false);

  if (lines.length === 0 || !market) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + SPACING.md }]}>
        <ScreenContainer style={styles.emptyContainer}>
          <ScreenHeader title="Finalizar pedido" />
          <EmptyState
            icon="cart.fill"
            title="Seu carrinho está vazio"
            subtitle="Adicione produtos de um mercado parceiro antes de finalizar."
            actionLabel="Explorar mercados"
            onAction={() => router.dismissTo('/markets')}
          />
        </ScreenContainer>
      </View>
    );
  }

  const standardFee = deliveryFeeFor(market, subtotal);
  const missingForFreeDelivery = standardFee > 0 ? market.freeDeliveryMinOrder - subtotal : 0;
  const deliveryOptions: DeliveryOption[] = [
    {
      key: 'padrao',
      label: 'Padrão',
      eta: `Chega em ${formatMinutesRange(market.deliveryMinMinutes, market.deliveryMaxMinutes)}`,
      fee: standardFee,
      etaMin: market.deliveryMinMinutes,
      etaMax: market.deliveryMaxMinutes,
      icon: 'truck.fill',
    },
    {
      key: 'expressa',
      label: 'Expressa',
      eta: `Chega em ${EXPRESS_DELIVERY.etaMinutes} min`,
      fee: EXPRESS_DELIVERY.fee,
      etaMin: EXPRESS_DELIVERY.etaMinutes,
      etaMax: EXPRESS_DELIVERY.etaMinutes,
      icon: 'bolt.fill',
    },
  ];
  const delivery = deliveryOptions.find((option) => option.key === deliveryOption) ?? deliveryOptions[0];
  const pickup = fulfillment === 'retirada';
  const deliveryFee = pickup ? 0 : delivery.fee;
  const total = subtotal + deliveryFee - discount;
  // Delivery precisa de endereço; na retirada o cliente vai até a loja.
  const canConfirm = pickup || Boolean(address);
  const fulfillmentOptions: { key: Fulfillment; hint: string; icon: IconSymbolName }[] = [
    { key: 'retirada', hint: `Grátis · retire em até ${PICKUP_WINDOW_HOURS} h`, icon: 'storefront.fill' },
    { key: 'entrega', hint: 'Receba no seu endereço', icon: 'truck.fill' },
  ];

  const savedCards = methods.filter((method): method is SavedCard => method.type === 'cartao');
  const selectedCard = selectedMethod?.type === 'cartao' ? selectedMethod : undefined;
  const displayCard = selectedCard ?? savedCards[0];
  const paymentKey: PaymentKey = selectedMethod?.type ?? 'pix';
  const paymentOptions: { key: PaymentKey; label: string; hint: string }[] = [
    { key: 'pix', label: 'Pix', hint: 'Na hora' },
    { key: 'cartao', label: 'Cartão', hint: displayCard ? `•••• ${displayCard.last4}` : 'Adicionar' },
    pickup ? { key: 'dinheiro', label: 'Na loja', hint: 'Pague na retirada' } : { key: 'dinheiro', label: 'Dinheiro', hint: 'Na entrega' },
  ];

  const handleSelectPayment = (key: PaymentKey) => {
    if (key === 'cartao') {
      if (displayCard) selectMethod(displayCard.id);
      else router.push('/add-card');
      return;
    }
    const method = methods.find((item) => item.type === key);
    if (method) selectMethod(method.id);
  };

  const handleConfirm = async () => {
    if (isPlacing || !canConfirm) return;
    setIsPlacing(true);
    // Without this try/finally, any error thrown while placing the order left isPlacing stuck at true
    // forever — every later tap of "Confirmar pedido" would then silently no-op on the isPlacing guard
    // above, with no error shown, looking exactly like the button had stopped working.
    try {
      // Na retirada o "endereço" do pedido é o da loja (é para lá que o cliente vai).
      const destination =
        pickup || !address
          ? { address: market.address, addressLat: market.lat, addressLng: market.lng }
          : { address: `${address.label} · ${address.street}, ${address.number}`, addressLat: address.lat, addressLng: address.lng };
      const order = await placeOrder({
        marketId: market.id,
        market: snapshotMarket(market),
        ...destination,
        fulfillment,
        lines: lines.map((line) => snapshotLine(line.product, line.quantity)),
        deliveryOption,
        deliveryFee,
        etaMinMinutes: pickup ? 0 : delivery.etaMin,
        etaMaxMinutes: pickup ? 0 : delivery.etaMax,
        paymentMethod: paymentKey,
        paymentDetail: selectedCard ? cardLabel(selectedCard) : undefined,
        subtotal,
        discount,
        total,
      });
      clearCart();
      refreshCatalog().catch(() => undefined); // o estoque mudou no banco
      router.replace({ pathname: paymentKey === 'pix' ? '/pix-payment' : '/order-confirmation', params: { id: order.id } });
    } catch (error) {
      Alert.alert('Não foi possível confirmar o pedido', errorMessage(error));
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <View style={styles.page}>
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.md }]}
          showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Finalizar pedido" />

          <View style={styles.card} accessibilityRole="radiogroup">
            <Text style={styles.cardTitle} accessibilityRole="header">
              Como você quer receber?
            </Text>
            {fulfillmentOptions.map((option) => {
              const isActive = fulfillment === option.key;
              return (
                <PressableScale
                  key={option.key}
                  style={[styles.optionRow, isActive && styles.optionRowActive]}
                  onPress={() => setFulfillment(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${FULFILLMENT_LABELS[option.key]}, ${option.hint}`}>
                  <View style={[styles.optionIcon, isActive && styles.optionIconActive]}>
                    <IconSymbol name={option.icon} size={20} color={COLORS.navy} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionLabel}>{FULFILLMENT_LABELS[option.key]}</Text>
                    <Text style={styles.optionEta}>{option.hint}</Text>
                  </View>
                  <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                    {isActive ? <View style={styles.radioInner} /> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {pickup ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Retirar em
              </Text>
              <View style={styles.addressRow}>
                <View style={styles.addressIcon}>
                  <IconSymbol name="storefront.fill" size={20} color={COLORS.navy} />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>{market.name}</Text>
                  <Text style={styles.addressDetail} numberOfLines={2}>
                    {market.address || 'Endereço da loja não informado'}
                  </Text>
                </View>
              </View>
              <View style={styles.freeDeliveryHint}>
                <IconSymbol name="clock.fill" size={14} color={COLORS.success} />
                <Text style={styles.freeDeliveryHintText}>
                  Retire em até {PICKUP_WINDOW_HOURS} horas mostrando o código do pedido no balcão.
                </Text>
              </View>
            </View>
          ) : (
            <>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle} accessibilityRole="header">
                  Endereço de entrega
                </Text>
                {address ? (
                  <PressableScale
                    onPress={() => router.push('/addresses')}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Alterar endereço de entrega">
                    <Text style={styles.cardAction}>Alterar</Text>
                  </PressableScale>
                ) : null}
              </View>
              {address ? (
                <View style={styles.addressRow}>
                  <View style={styles.addressIcon}>
                    <IconSymbol name="location.fill" size={20} color={COLORS.navy} />
                  </View>
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>{address.label}</Text>
                    <Text style={styles.addressDetail} numberOfLines={2}>
                      {address.street}, {address.number}
                      {address.complement ? ` · ${address.complement}` : ''}
                    </Text>
                  </View>
                </View>
              ) : (
                <Button
                  label="Adicionar endereço de entrega"
                  icon="plus"
                  variant="secondary"
                  size="compact"
                  onPress={() => router.push('/new-address')}
                />
              )}
            </View>

            <View style={styles.card} accessibilityRole="radiogroup">
              <Text style={styles.cardTitle} accessibilityRole="header">
                Opção de entrega
              </Text>
              {deliveryOptions.map((option) => {
                const isActive = deliveryOption === option.key;
                return (
                  <PressableScale
                    key={option.key}
                    style={[styles.optionRow, isActive && styles.optionRowActive]}
                    onPress={() => setDeliveryOption(option.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={`${option.label}, ${option.eta}, ${
                      option.fee === 0 ? 'grátis' : formatCurrency(option.fee)
                    }`}>
                    <View style={[styles.optionIcon, isActive && styles.optionIconActive]}>
                      <IconSymbol name={option.icon} size={20} color={COLORS.navy} />
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      <Text style={styles.optionEta}>{option.eta}</Text>
                    </View>
                    <Text style={[styles.optionFee, option.fee === 0 && styles.optionFeeFree]}>
                      {option.fee === 0 ? 'Grátis' : formatCurrency(option.fee)}
                    </Text>
                    <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                      {isActive ? <View style={styles.radioInner} /> : null}
                    </View>
                  </PressableScale>
                );
              })}
              {missingForFreeDelivery > 0 ? (
                <View style={styles.freeDeliveryHint}>
                  <IconSymbol name="truck.fill" size={14} color={COLORS.success} />
                  <Text style={styles.freeDeliveryHintText}>
                    Faltam {formatCurrency(missingForFreeDelivery)} para frete grátis no {market.name}.
                  </Text>
                </View>
              ) : null}
            </View>

            </>
          )}

          <View style={styles.card} accessibilityRole="radiogroup">
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Forma de pagamento
              </Text>
              {savedCards.length > 1 ? (
                <PressableScale
                  onPress={() => router.push('/payments')}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Escolher outro cartão">
                  <Text style={styles.cardAction}>Trocar cartão</Text>
                </PressableScale>
              ) : null}
            </View>
            <View style={styles.paymentRow}>
              {paymentOptions.map((method) => {
                const isActive = paymentKey === method.key;
                return (
                  <PressableScale
                    key={method.key}
                    style={[styles.paymentOption, isActive && styles.paymentOptionActive]}
                    onPress={() => handleSelectPayment(method.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={`${method.label}, ${method.hint}`}>
                    <Image source={PAYMENT_ICONS[method.key]} style={styles.paymentIcon} contentFit="contain" />
                    <Text style={styles.paymentLabel}>{method.label}</Text>
                    <Text style={styles.paymentHint} numberOfLines={1}>
                      {method.hint}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {appliedCoupon ? (
            <View style={styles.couponCard}>
              <IconSymbol name="tag.fill" size={18} color={COLORS.orange} />
              <View style={styles.couponInfo}>
                <Text style={styles.couponCode}>{appliedCoupon.code}</Text>
                <Text style={styles.couponLabel}>{appliedCoupon.label} aplicado</Text>
              </View>
              <PressableScale
                style={styles.couponRemoveButton}
                onPress={removeCoupon}
                accessibilityRole="button"
                accessibilityLabel={`Remover cupom ${appliedCoupon.code}`}>
                <Text style={styles.couponRemoveText}>Remover</Text>
              </PressableScale>
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({pluralize(itemCount, 'item', 'itens')})</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{pickup ? 'Retirada no local' : 'Entrega'}</Text>
              <Text style={[styles.summaryValue, deliveryFee === 0 && styles.summaryValueGreen]}>
                {deliveryFee === 0 ? 'Grátis' : formatCurrency(deliveryFee)}
              </Text>
            </View>
            {appliedCoupon ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cupom {appliedCoupon.code}</Text>
                <Text style={[styles.summaryValue, styles.summaryValueGreen]}>– {formatCurrency(discount)}</Text>
              </View>
            ) : null}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>

      <BottomBar>
        <Button
          label="Confirmar pedido"
          onPress={handleConfirm}
          disabled={!canConfirm}
          loading={isPlacing}
          accessibilityHint={canConfirm ? undefined : 'Adicione um endereço de entrega ou escolha retirar no local'}
          trailing={<Text style={styles.confirmButtonPrice}>{formatCurrency(total)}</Text>}
        />
      </BottomBar>
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
    gap: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.bold,
  },
  cardAction: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  addressDetail: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionRowActive: {
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    backgroundColor: 'rgba(236,238,255,0.5)',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: {
    backgroundColor: COLORS.surface,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  optionEta: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    marginTop: 2,
  },
  optionFee: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  optionFeeFree: {
    color: COLORS.success,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: COLORS.navy,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.navy,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentOption: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    paddingVertical: 12,
  },
  paymentOptionActive: {
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    backgroundColor: 'rgba(236,238,255,0.5)',
  },
  paymentIcon: {
    width: 28,
    height: 28,
  },
  paymentLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  paymentHint: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  couponInfo: {
    flex: 1,
  },
  couponCode: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  couponLabel: {
    color: COLORS.success,
    fontSize: FONT_SIZES.small,
  },
  couponRemoveButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponRemoveText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 16,
    gap: 8,
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
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  summaryTotalLabel: {
    ...TYPOGRAPHY.cardTitle,
  },
  summaryTotalValue: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.h2,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  freeDeliveryHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    backgroundColor: COLORS.successSoft,
    borderRadius: RADIUS.small,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  freeDeliveryHintText: {
    flex: 1,
    color: COLORS.success,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  emptyContainer: {
    paddingHorizontal: SPACING.lg,
  },
  addressInfo: {
    flex: 1,
  },
  summaryValueGreen: {
    color: COLORS.success,
  },
  confirmButtonPrice: {
    color: COLORS.onDarkMuted,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
