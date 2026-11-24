import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { getPartner } from '@/data/partners';
import type { Product } from '@/data/products';
import { formatCurrency } from '@/utils/currency';
import { useCatalogVersion } from '@/contexts/catalog-context';

type ProductCardProps = {
  product: Product;
  favorited: boolean;
  onToggleFavorite: () => void;
  onAdd: () => void;
  quantityInCart?: number;
  showMarket?: boolean;
  /** `raised` for grey pages (white card), `outlined` for white sheets (bordered card). */
  tone?: 'raised' | 'outlined';
};

export function ProductCard({
  product,
  favorited,
  onToggleFavorite,
  onAdd,
  quantityInCart = 0,
  showMarket = true,
  tone = 'raised',
}: ProductCardProps) {
  useCatalogVersion();
  const router = useRouter();
  const marketName = showMarket ? getPartner(product.marketId)?.name : undefined;

  const openDetails = () => router.push({ pathname: '/product/[id]', params: { id: product.id } });

  // The card body, the heart and the add button are siblings rather than nested: a pressable inside a
  // pressable hides the inner one from VoiceOver/TalkBack (the outer one becomes a single accessible
  // element) and is invalid HTML on web (<button> inside <button>).
  return (
    <View style={[styles.card, tone === 'outlined' && styles.cardOutlined]}>
      <PressableScale
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={`${product.title}, ${formatCurrency(product.price)} por ${product.unit}${
          marketName ? `, ${marketName}` : ''
        }`}
        accessibilityHint="Abre os detalhes do produto"
        onPress={openDetails}>
        <View style={styles.media}>
          <Image source={product.image} style={styles.image} contentFit="contain" transition={150} />
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {product.title}
          </Text>
          {marketName ? (
            <Text style={styles.market} numberOfLines={1}>
              {marketName}
            </Text>
          ) : null}
          {product.discountPercent && product.originalPrice ? (
            <Text style={styles.deal} numberOfLines={1}>
              -{product.discountPercent}% · de {formatCurrency(product.originalPrice)}
            </Text>
          ) : null}
          {product.expiresAt ? (
            <Text style={styles.expiry} numberOfLines={1}>
              Vence em {new Date(product.expiresAt).toLocaleDateString('pt-BR')}
            </Text>
          ) : null}
        </View>
      </PressableScale>

      <PressableScale
        style={styles.heartButton}
        onPress={onToggleFavorite}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ selected: favorited }}
        accessibilityLabel={favorited ? `Remover ${product.title} dos favoritos` : `Favoritar ${product.title}`}>
        <IconSymbol name="heart.fill" size={16} color={favorited ? COLORS.error : COLORS.muted} />
      </PressableScale>

      <View style={styles.footer}>
        <View style={styles.priceRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text style={styles.price} numberOfLines={1}>
            {formatCurrency(product.price)}
          </Text>
          <Text style={styles.unit}>/{product.unit}</Text>
        </View>
        <PressableScale
          style={styles.addButton}
          onPress={onAdd}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Adicionar ${product.title} ao carrinho`}>
          <IconSymbol name="plus" size={18} color={COLORS.onDark} />
        </PressableScale>
      </View>

      {quantityInCart > 0 ? (
        <Text style={styles.inCart} accessibilityLiveRegion="polite">
          {quantityInCart} no carrinho
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 10,
    gap: 10,
  },
  body: {
    gap: 10,
  },
  cardOutlined: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  media: {
    height: 118,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '85%',
    height: '85%',
  },
  heartButton: {
    position: 'absolute',
    // Card padding (10) + inset inside the media well.
    top: 10 + SPACING.xs,
    right: 10 + SPACING.xs,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingHorizontal: 4,
    gap: 2,
  },
  title: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
  },
  market: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  deal: {
    color: COLORS.orange,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  expiry: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
  },
  priceRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 2,
    marginRight: SPACING.xxs,
  },
  price: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  unit: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.small,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCart: {
    color: COLORS.success,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
    paddingLeft: 4,
  },
});
