import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { getPartner } from '@/data/partners';
import { getProduct } from '@/data/products';
import { reviewsFor } from '@/data/reviews';
import { useFlash } from '@/hooks/use-flash';
import { useGuardedAddToCart } from '@/hooks/use-guarded-add-to-cart';
import { formatCurrency } from '@/utils/currency';
import { formatMinutesRange } from '@/utils/format';
import { getPriceComparisons } from '@/utils/price-compare';
import { shareText } from '@/utils/share';
import { useCatalogVersion } from '@/contexts/catalog-context';
import { formatDistance } from '@/services/distance-core';

const MAX_QUANTITY = 99;

export default function ProductDetailScreen() {
  useCatalogVersion();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addToCart, modal } = useGuardedAddToCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, flashAdded] = useFlash();

  const product = getProduct(id);
  const market = getPartner(product?.marketId);

  if (!product || !market) {
    return (
      <View style={styles.page}>
        <View style={[styles.notFoundHeader, { paddingTop: insets.top + SPACING.md }]}>
          <ScreenHeader />
        </View>
        <EmptyState
          icon="bag.fill"
          title="Produto não encontrado"
          subtitle="Esse produto pode ter saído do catálogo."
          actionLabel="Ver mercados"
          onAction={() => router.replace('/markets')}
        />
      </View>
    );
  }

  const favorited = isFavorite(product.id);
  const reviews = reviewsFor(market.id);
  const comparisons = getPriceComparisons(product.id, market.id, product.price);

  const description = `${product.title} do ${market.name}, vendido por ${
    product.unit === 'kg' ? 'quilo' : product.unit
  }. Confira o preço e compare com outros mercados parceiros antes de reservar.`;

  const handleIncrement = () => setQuantity((current) => Math.min(MAX_QUANTITY, current + 1));
  const handleDecrement = () => setQuantity((current) => Math.max(1, current - 1));

  const handleAdd = () => {
    // Only confirm when the item actually went in; a cross-market conflict opens the modal instead.
    if (addToCart(product.id, quantity)) {
      setQuantity(1);
      flashAdded();
    }
  };

  const handleShare = () =>
    shareText(
      product.title,
      `${product.title} por ${formatCurrency(product.price)}/${product.unit} no ${market.name} — encontrei no FireStock.`
    );

  return (
    <View style={styles.page}>
      <View style={[styles.floatingActions, { top: insets.top + SPACING.sm }]}>
        <IconButton
          icon="chevron.left"
          accessibilityLabel="Voltar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        />
        <View style={styles.floatingActionsRight}>
          <IconButton icon="square.and.arrow.up" accessibilityLabel="Compartilhar produto" onPress={handleShare} />
          <IconButton
            icon="heart.fill"
            accessibilityLabel={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            color={favorited ? COLORS.error : COLORS.navy}
            onPress={() => toggleFavorite(product.id)}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          <View style={styles.heroGlow} />
          <Image
            source={product.image}
            style={styles.heroImage}
            contentFit="contain"
            transition={150}
            accessibilityLabel={product.title}
          />
        </View>

        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <View style={styles.titleStack}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{product.category}</Text>
              </View>
              <Text style={styles.productTitle} accessibilityRole="header">
                {product.title}
              </Text>
              <PressableScale
                style={styles.marketRow}
                onPress={() => router.push({ pathname: '/market/[id]', params: { id: market.id } })}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel={`Vendido por ${market.name}, a ${formatDistance(market.distanceKm)}`}>
                <Image source={market.image} style={styles.marketAvatar} contentFit="cover" />
                <Text style={styles.marketName}>
                  {market.name} · {formatDistance(market.distanceKm)}
                </Text>
                <IconSymbol name="chevron.right" size={14} color={COLORS.textTertiary} />
              </PressableScale>
            </View>
            <View style={styles.priceStack}>
              <Text style={styles.price}>{formatCurrency(product.price)}</Text>
              <Text style={styles.priceUnit}>por {product.unit}</Text>
              {product.discountPercent && product.originalPrice ? (
                <Text style={styles.deal}>
                  -{product.discountPercent}% · de {formatCurrency(product.originalPrice)}
                </Text>
              ) : null}
              {product.expiresAt ? (
                <Text style={styles.priceUnit}>Vence em {new Date(product.expiresAt).toLocaleDateString('pt-BR')}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.chipsRow}>
            {reviews.length > 0 ? (
              <View style={styles.chip}>
                <IconSymbol name="star.fill" size={14} color={COLORS.warning} />
                <Text style={styles.chipText}>
                  {market.rating.toFixed(1)} ({reviews.length})
                </Text>
              </View>
            ) : null}
            <View style={styles.chip}>
              <IconSymbol name="truck.fill" size={14} color={COLORS.navy} />
              <Text style={styles.chipText}>{formatMinutesRange(market.deliveryMinMinutes, market.deliveryMaxMinutes)}</Text>
            </View>
            <View style={styles.chip}>
              <IconSymbol name="storefront.fill" size={14} color={COLORS.navy} />
              <Text style={styles.chipText}>{market.category}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descrição</Text>
            <Text style={styles.description}>{description}</Text>
          </View>

          {comparisons.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.compareHeader}>
                <Text style={styles.sectionTitle}>Compare em outros mercados</Text>
                {comparisons.every((comparison) => comparison.difference >= 0) ? (
                  <View style={styles.bestPriceBadge}>
                    <Text style={styles.bestPriceBadgeText}>Melhor preço aqui</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.compareList}>
                {comparisons.map((comparison) => (
                  <View
                    key={comparison.market.id}
                    style={styles.compareRow}
                    accessible
                    accessibilityLabel={`${comparison.market.name}: ${formatCurrency(comparison.price)}, ${formatCurrency(
                      Math.abs(comparison.difference)
                    )} ${comparison.difference >= 0 ? 'mais caro' : 'mais barato'}`}>
                    <Image source={comparison.market.image} style={styles.compareAvatar} contentFit="cover" />
                    <View style={styles.compareInfo}>
                      <Text style={styles.compareName}>{comparison.market.name}</Text>
                      <Text style={styles.compareDistance}>{formatDistance(comparison.market.distanceKm)}</Text>
                    </View>
                    <View style={styles.comparePriceStack}>
                      <Text style={styles.comparePrice}>
                        {formatCurrency(comparison.price)}/{product.unit}
                      </Text>
                      <Text style={styles.compareDifference}>
                        {comparison.difference >= 0 ? '+' : '-'} {formatCurrency(Math.abs(comparison.difference))}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BottomBar style={styles.addBar}>
        <View style={styles.stepper}>
          <PressableScale
            style={[styles.stepperButton, styles.stepperButtonLight]}
            onPress={handleDecrement}
            disabled={quantity <= 1}
            accessibilityRole="button"
            accessibilityLabel="Diminuir quantidade">
            <IconSymbol name="minus" size={16} color={COLORS.navy} />
          </PressableScale>
          <View
            style={styles.stepperValueStack}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${quantity} ${product.unit}`}>
            <Text style={styles.stepperValue}>{quantity}</Text>
            <Text style={styles.stepperUnit} numberOfLines={1}>
              {product.unit}
            </Text>
          </View>
          <PressableScale
            style={[styles.stepperButton, styles.stepperButtonDark]}
            onPress={handleIncrement}
            disabled={quantity >= MAX_QUANTITY}
            accessibilityRole="button"
            accessibilityLabel="Aumentar quantidade">
            <IconSymbol name="plus" size={16} color={COLORS.onDark} />
          </PressableScale>
        </View>

        <Button
          label={justAdded ? 'Adicionado!' : `Adicionar · ${formatCurrency(product.price * quantity)}`}
          icon={justAdded ? 'checkmark' : undefined}
          onPress={handleAdd}
          style={styles.addButton}
          accessibilityLabel={`Adicionar ${quantity} ${product.unit} de ${product.title} ao carrinho por ${formatCurrency(
            product.price * quantity
          )}`}
        />
      </BottomBar>

      {modal}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  notFoundHeader: {
    paddingHorizontal: SPACING.lg,
  },
  floatingActions: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingActionsRight: {
    flexDirection: 'row',
    gap: 10,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  hero: {
    width: '100%',
    aspectRatio: 1.15,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlow: {
    position: 'absolute',
    width: '75%',
    aspectRatio: 1,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },
  heroImage: {
    width: '65%',
    height: '65%',
  },
  sheet: {
    marginTop: -RADIUS.xl,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleStack: {
    flex: 1,
    gap: 6,
    paddingRight: SPACING.sm,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  categoryBadgeText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  productTitle: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: -0.2,
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  marketAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  marketName: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
  },
  priceStack: {
    alignItems: 'flex-end',
  },
  price: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: -0.2,
  },
  priceUnit: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  deal: {
    color: COLORS.orange,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  chipText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.bold,
  },
  description: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.body,
    lineHeight: 21,
  },
  compareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bestPriceBadge: {
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  bestPriceBadgeText: {
    color: COLORS.success,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  compareList: {
    gap: 10,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.medium,
    padding: 10,
  },
  compareAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  compareInfo: {
    flex: 1,
    gap: 2,
  },
  compareName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  compareDistance: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  comparePriceStack: {
    alignItems: 'flex-end',
    gap: 2,
  },
  comparePrice: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  compareDifference: {
    color: COLORS.error,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.pill,
    padding: 4,
  },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonLight: {
    backgroundColor: COLORS.surface,
  },
  stepperButtonDark: {
    backgroundColor: COLORS.navy,
  },
  stepperValueStack: {
    minWidth: 44,
    alignItems: 'center',
  },
  stepperValue: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.bold,
  },
  stepperUnit: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
  },
  addButton: {
    flex: 1,
    width: 'auto',
    paddingHorizontal: SPACING.md,
  },
});
