import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SHADOW_BAR, SPACING, TYPOGRAPHY } from '@/components/ui/theme';
import { useCart } from '@/contexts/cart-context';
import { useOrders } from '@/contexts/order-context';
import { getPartner } from '@/data/partners';
import { useCartSummary } from '@/hooks/use-cart-summary';
import { useGuardedAddToCart } from '@/hooks/use-guarded-add-to-cart';
import { formatCurrency } from '@/utils/currency';
import { formatShortDate } from '@/utils/date';
import { formatMinutesRange, pluralize } from '@/utils/format';
import { INPUT_LIMITS, sanitizeCoupon } from '@/utils/sanitize';
import { useCatalogVersion } from '@/contexts/catalog-context';

const REPLACEMENT_OPTIONS = ['Substituir por um similar', 'Cancelar o item'] as const;

export default function CartScreen() {
  useCatalogVersion();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, removeItem, clearCart, applyCoupon, removeCoupon } = useCart();
  const { lines, market, itemCount, subtotal, discount, appliedCoupon } = useCartSummary();
  const { orders } = useOrders();
  const { addLinesToCart, modal } = useGuardedAddToCart();
  const [replacementIndex, setReplacementIndex] = useState(0);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  const lastOrder = orders[0];
  const lastOrderMarket = getPartner(lastOrder?.marketId);
  const total = subtotal - discount;

  const handleReorderLast = () => {
    if (!lastOrder) return;
    addLinesToCart(
      lastOrder.lines.map((line) => ({ id: line.productId, quantity: line.quantity })),
      'os itens do pedido anterior'
    );
  };

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) {
      setCouponError('Digite o código do cupom.');
      return;
    }
    const ok = applyCoupon(couponInput);
    setCouponError(ok ? '' : 'Cupom inválido ou expirado.');
    if (ok) setCouponInput('');
  };

  const handleClearCart = () => {
    Alert.alert('Esvaziar carrinho?', `Os ${pluralize(itemCount, 'item', 'itens')} do carrinho serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Esvaziar', style: 'destructive', onPress: clearCart },
    ]);
  };

  if (lines.length === 0 || !market) {
    return (
      <View style={styles.page}>
        <ScreenContainer style={[styles.emptyContainer, { paddingTop: insets.top + SPACING.md }]}>
          <ScreenHeader title="Meu carrinho" showBack={false} />
          <View style={styles.emptyBody}>
            <EmptyState
              icon="cart.fill"
              title="Seu carrinho está vazio"
              subtitle="Adicione produtos de um mercado parceiro para começar."
              actionLabel="Explorar mercados"
              onAction={() => router.navigate('/markets')}
            />

            {lastOrder && lastOrderMarket ? (
              <View style={styles.lastOrderCard}>
                <Text style={styles.lastOrderLabel}>SEU ÚLTIMO PEDIDO</Text>
                <View style={styles.lastOrderRow}>
                  <Image source={lastOrderMarket.image} style={styles.lastOrderImage} contentFit="cover" />
                  <View style={styles.lastOrderInfo}>
                    <Text style={styles.lastOrderName}>{lastOrderMarket.name}</Text>
                    <Text style={styles.lastOrderDetail}>
                      {formatShortDate(new Date(lastOrder.createdAt))} ·{' '}
                      {pluralize(
                        lastOrder.lines.reduce((sum, line) => sum + line.quantity, 0),
                        'item',
                        'itens'
                      )}{' '}
                      · {formatCurrency(lastOrder.total)}
                    </Text>
                  </View>
                  <PressableScale style={styles.lastOrderButton} onPress={handleReorderLast} accessibilityRole="button">
                    <Text style={styles.lastOrderButtonText}>Pedir de novo</Text>
                  </PressableScale>
                </View>
              </View>
            ) : null}
          </View>
        </ScreenContainer>
        {modal}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior="padding">
      <ScreenContainer>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.md }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ScreenHeader
            title="Meu carrinho"
            showBack={false}
            style={styles.header}
            right={<IconButton icon="trash.fill" accessibilityLabel="Esvaziar carrinho" onPress={handleClearCart} />}
          />

          <PressableScale
            style={styles.storeSummary}
            onPress={() => router.push({ pathname: '/market/[id]', params: { id: market.id } })}
            accessibilityRole="button"
            accessibilityHint="Abre o mercado para adicionar mais itens">
            <Image source={market.image} style={styles.storeImage} contentFit="cover" />
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{market.name}</Text>
              <View style={styles.storeMetaRow}>
                <IconSymbol name="clock.fill" size={13} color={COLORS.textTertiary} />
                <Text style={styles.storeMetaText}>
                  Entrega em {formatMinutesRange(market.deliveryMinMinutes, market.deliveryMaxMinutes)}
                </Text>
              </View>
            </View>
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountBadgeText}>{pluralize(itemCount, 'item', 'itens')}</Text>
            </View>
          </PressableScale>

          {lines.map(({ product, quantity }) => (
            <View key={product.id} style={styles.cartItem}>
              <View style={styles.cartItemMedia}>
                <Image source={product.image} style={styles.cartItemImage} contentFit="contain" />
              </View>
              <View style={styles.cartItemInfo}>
                <View>
                  <Text style={styles.cartItemTitle}>{product.title}</Text>
                  <Text style={styles.cartItemUnitPrice}>
                    {formatCurrency(product.price)}/{product.unit}
                  </Text>
                </View>
                <View style={styles.cartItemFooter}>
                  <Text style={styles.cartItemTotal}>{formatCurrency(product.price * quantity)}</Text>
                  <View style={styles.stepper}>
                    <PressableScale
                      style={styles.stepperButtonLight}
                      onPress={() => removeItem(product.id)}
                      hitSlop={7}
                      accessibilityRole="button"
                      accessibilityLabel={
                        quantity === 1 ? `Remover ${product.title} do carrinho` : `Diminuir quantidade de ${product.title}`
                      }>
                      <IconSymbol name={quantity === 1 ? 'trash.fill' : 'minus'} size={14} color={COLORS.navy} />
                    </PressableScale>
                    <Text style={styles.stepperValue} accessibilityLabel={`Quantidade: ${quantity}`}>
                      {quantity}
                    </Text>
                    <PressableScale
                      style={styles.stepperButtonDark}
                      onPress={() => addItem(product.id)}
                      hitSlop={7}
                      accessibilityRole="button"
                      accessibilityLabel={`Aumentar quantidade de ${product.title}`}>
                      <IconSymbol name="plus" size={14} color={COLORS.onDark} />
                    </PressableScale>
                  </View>
                </View>
              </View>
            </View>
          ))}

          <PressableScale
            style={styles.replacementRow}
            onPress={() => setReplacementIndex((current) => (current + 1) % REPLACEMENT_OPTIONS.length)}
            accessibilityRole="button"
            accessibilityLabel={`Se faltar algum item: ${REPLACEMENT_OPTIONS[replacementIndex]}`}
            accessibilityHint="Toque para alternar a opção">
            <View style={styles.replacementIcon}>
              <IconSymbol name="shippingbox.fill" size={20} color={COLORS.navy} />
            </View>
            <View style={styles.replacementInfo}>
              <Text style={styles.replacementTitle}>Se faltar algum item</Text>
              <Text style={styles.replacementSubtitle}>{REPLACEMENT_OPTIONS[replacementIndex]}</Text>
            </View>
            <View style={styles.replacementAction}>
              <Text style={styles.replacementActionText}>Alterar</Text>
              <IconSymbol name="chevron.down" size={14} color={COLORS.primary} />
            </View>
          </PressableScale>

          {appliedCoupon ? (
            <View style={styles.couponApplied}>
              <IconSymbol name="tag.fill" size={18} color={COLORS.success} />
              <Text style={styles.couponSuccess}>
                Cupom {appliedCoupon.code} aplicado — {appliedCoupon.label}
              </Text>
              <PressableScale onPress={removeCoupon} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remover cupom">
                <IconSymbol name="xmark" size={16} color={COLORS.textTertiary} />
              </PressableScale>
            </View>
          ) : (
            <View style={styles.couponBox}>
              <View style={[styles.couponRow, couponError ? styles.couponRowError : null]}>
                <IconSymbol name="tag.fill" size={20} color={COLORS.navy} />
                <TextInput
                  value={couponInput}
                  onChangeText={(text) => {
                    setCouponInput(sanitizeCoupon(text));
                    setCouponError('');
                  }}
                  placeholder="Adicionar cupom de desconto"
                  placeholderTextColor={COLORS.textFaint}
                  autoCapitalize="characters"
                  maxLength={INPUT_LIMITS.coupon}
                  autoCorrect={false}
                  returnKeyType="done"
                  style={styles.couponInput}
                  onSubmitEditing={handleApplyCoupon}
                  accessibilityLabel="Código do cupom"
                />
                <PressableScale
                  onPress={handleApplyCoupon}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Aplicar cupom">
                  <Text style={styles.couponApply}>Aplicar</Text>
                </PressableScale>
              </View>
              {couponError ? (
                <Text style={styles.couponError} accessibilityLiveRegion="polite">
                  {couponError}
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </ScreenContainer>

      <View style={styles.checkoutBar}>
        <ScreenContainer fill={false} style={styles.checkoutBarContent}>
          <View>
            <Text style={styles.totalLabel}>{discount > 0 ? 'Total com desconto' : 'Subtotal'}</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
          <Button
            label="Finalizar compra"
            icon="chevron.right"
            iconPosition="trailing"
            onPress={() => router.push('/checkout')}
            style={styles.checkoutButton}
          />
        </ScreenContainer>
      </View>

      {modal}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  header: {
    marginBottom: SPACING.xs,
  },
  emptyContainer: {
    paddingHorizontal: SPACING.lg,
  },
  emptyBody: {
    flex: 1,
    justifyContent: 'center',
  },
  storeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 12,
  },
  storeImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  storeInfo: {
    flex: 1,
    gap: 2,
  },
  storeName: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: FONT_WEIGHTS.bold,
  },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeMetaText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  itemCountBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  itemCountBadgeText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 12,
  },
  cartItemMedia: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemImage: {
    width: '80%',
    height: '80%',
  },
  cartItemInfo: {
    flex: 1,
    gap: 8,
  },
  cartItemTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: FONT_WEIGHTS.bold,
  },
  cartItemUnitPrice: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  cartItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartItemTotal: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.pill,
    padding: 3,
  },
  stepperButtonLight: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: FONT_WEIGHTS.bold,
    minWidth: 16,
    textAlign: 'center',
  },
  replacementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  replacementIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replacementInfo: {
    flex: 1,
    gap: 2,
  },
  replacementTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  replacementSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  replacementAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replacementActionText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  couponBox: {
    gap: 6,
  },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.successSoft,
    borderRadius: RADIUS.medium,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    borderStyle: 'dashed',
    borderRadius: RADIUS.medium,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  couponRowError: {
    borderColor: COLORS.error,
  },
  couponApply: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  couponInput: {
    flex: 1,
    color: COLORS.navy,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  couponError: {
    color: COLORS.error,
    fontSize: FONT_SIZES.small,
    paddingLeft: 4,
  },
  couponSuccess: {
    flex: 1,
    color: COLORS.success,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  checkoutBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    ...SHADOW_BAR,
  },
  checkoutBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  totalLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  totalValue: {
    ...TYPOGRAPHY.screenTitle,
  },
  checkoutButton: {
    flex: 1,
    width: 'auto',
  },
  lastOrderCard: {
    width: '100%',
    marginTop: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 14,
    gap: 10,
  },
  lastOrderLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.4,
  },
  lastOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastOrderImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  lastOrderInfo: {
    flex: 1,
    gap: 2,
  },
  lastOrderName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  lastOrderDetail: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  lastOrderButton: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastOrderButtonText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
