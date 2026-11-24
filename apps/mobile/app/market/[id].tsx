import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchField } from '@/components/ui/search-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StarRating } from '@/components/ui/star-rating';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { TwoColumnGrid } from '@/components/ui/two-column-grid';
import { useCart } from '@/contexts/cart-context';
import { useFavorites } from '@/contexts/favorites-context';
import { getPartner } from '@/data/partners';
import { PRODUCTS, type Product } from '@/data/products';
import { ratingDistribution, reviewsFor } from '@/data/reviews';
import { useGuardedAddToCart } from '@/hooks/use-guarded-add-to-cart';
import { formatCurrency } from '@/utils/currency';
import { formatMinutesRange, initials, normalizeSearch, pluralize } from '@/utils/format';
import { shareText } from '@/utils/share';
import { useCatalogRefreshControl, useCatalogVersion } from '@/contexts/catalog-context';
import { formatDistance } from '@/services/distance-core';

type Tab = 'produtos' | 'avaliacoes' | 'sobre';

export default function MarketDetailScreen() {
  useCatalogVersion();
  const refreshControl = useCatalogRefreshControl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addToCart, modal } = useGuardedAddToCart();
  const { quantityOf } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [tab, setTab] = useState<Tab>('produtos');
  const [productQuery, setProductQuery] = useState('');
  const [category, setCategory] = useState<Product['category'] | null>(null);

  const market = getPartner(id);

  if (!market) {
    return (
      <View style={styles.page}>
        <View style={[styles.notFoundHeader, { paddingTop: insets.top + SPACING.md }]}>
          <ScreenHeader />
        </View>
        <EmptyState
          icon="storefront.fill"
          title="Mercado não encontrado"
          subtitle="Esse parceiro pode ter saído do catálogo."
          actionLabel="Ver mercados"
          onAction={() => router.replace('/markets')}
        />
      </View>
    );
  }

  const allProducts = PRODUCTS.filter((product) => product.marketId === market.id);
  const categories = Array.from(new Set(allProducts.map((product) => product.category)));
  const query = normalizeSearch(productQuery);
  const products = allProducts.filter(
    (product) => (!category || product.category === category) && normalizeSearch(product.title).includes(query)
  );
  const reviews = reviewsFor(market.id);
  const distribution = ratingDistribution(market.id);
  const maxDistributionCount = Math.max(...Object.values(distribution), 1);
  const favorited = isFavorite(market.id);
  const deliveryWindow = formatMinutesRange(market.deliveryMinMinutes, market.deliveryMaxMinutes);

  const handleShare = () =>
    shareText(market.name, `${market.name} (${market.category}) — ${market.address}. Peça pelo FireStock!`);

  return (
    <View style={styles.page}>
      <View style={[styles.floatingActions, { top: insets.top + SPACING.sm }]}>
        <IconButton
          icon="chevron.left"
          accessibilityLabel="Voltar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/markets'))}
        />
        <View style={styles.floatingActionsRight}>
          <IconButton icon="square.and.arrow.up" accessibilityLabel="Compartilhar mercado" onPress={handleShare} />
          <IconButton
            icon="heart.fill"
            accessibilityLabel={favorited ? 'Remover mercado dos favoritos' : 'Favoritar mercado'}
            color={favorited ? COLORS.error : COLORS.navy}
            onPress={() => toggleFavorite(market.id)}
          />
        </View>
      </View>

      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={market.banner ?? market.image}
            style={styles.heroImage}
            contentFit="cover"
            accessibilityLabel={`Banner do ${market.name}`}
          />
          <View style={styles.heroShade} />
        </View>

        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Image source={market.image} style={styles.titleAvatar} contentFit="cover" accessible={false} />
            <View style={styles.titleInfo}>
              <Text style={styles.marketName} accessibilityRole="header">
                {market.name}
              </Text>
              <View style={styles.metaRow}>
                <IconSymbol name="location.fill" size={13} color={COLORS.textTertiary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {market.address} · {formatDistance(market.distanceKm)}
                </Text>
              </View>
            </View>
            <View style={styles.openBadge}>
              <Text style={styles.openBadgeText}>Aberto</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View
              style={styles.statBox}
              accessible
              accessibilityLabel={`Nota ${market.rating.toFixed(1)}, ${pluralize(reviews.length, 'avaliação', 'avaliações')}`}>
              <View style={styles.statTopRow}>
                <IconSymbol name="star.fill" size={15} color={COLORS.warning} />
                <Text style={styles.statValue}>{market.rating.toFixed(1)}</Text>
              </View>
              <Text style={styles.statLabel}>{pluralize(reviews.length, 'avaliação', 'avaliações')}</Text>
            </View>
            <View style={styles.statBox} accessible accessibilityLabel={`Entrega em ${deliveryWindow}`}>
              <View style={styles.statTopRow}>
                <IconSymbol name="clock.fill" size={15} color={COLORS.navy} />
                <Text style={styles.statValue}>{deliveryWindow}</Text>
              </View>
              <Text style={styles.statLabel}>Tempo de entrega</Text>
            </View>
            <View
              style={styles.statBox}
              accessible
              accessibilityLabel={
                market.deliveryFee === 0
                  ? 'Entrega grátis'
                  : `Entrega ${formatCurrency(market.deliveryFee)}, grátis acima de ${formatCurrency(
                      market.freeDeliveryMinOrder
                    )}`
              }>
              <View style={styles.statTopRow}>
                <IconSymbol name="truck.fill" size={15} color={COLORS.navy} />
                <Text style={styles.statValue}>{market.deliveryFee === 0 ? 'Grátis' : formatCurrency(market.deliveryFee)}</Text>
              </View>
              <Text style={styles.statLabel}>
                {market.deliveryFee === 0 ? 'Sem taxa' : `Grátis acima de ${formatCurrency(market.freeDeliveryMinOrder)}`}
              </Text>
            </View>
          </View>

          <SegmentedControl
            tone="onSurface"
            value={tab}
            onChange={setTab}
            options={[
              { key: 'produtos', label: 'Produtos' },
              { key: 'avaliacoes', label: 'Avaliações' },
              { key: 'sobre', label: 'Sobre' },
            ]}
          />

          {tab === 'produtos' ? (
            <>
              <View style={styles.catalogFilters}>
                <SearchField
                  tone="filled"
                  value={productQuery}
                  onChangeText={setProductQuery}
                  placeholder={`Buscar no ${market.name}`}
                />
                {categories.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                    <Chip tone="filled" label="Todos" selected={category === null} onPress={() => setCategory(null)} />
                    {categories.map((item) => (
                      <Chip
                        key={item}
                        tone="filled"
                        label={item}
                        selected={category === item}
                        onPress={() => setCategory(item)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>

              {products.length === 0 ? (
                <EmptyState
                  compact
                  icon="bag.fill"
                  title={allProducts.length === 0 ? 'Catálogo em breve' : 'Nenhum produto encontrado'}
                  subtitle={
                    allProducts.length === 0
                      ? 'Esse parceiro ainda não publicou produtos no app.'
                      : 'Tente buscar por outro termo ou categoria.'
                  }
                />
              ) : (
                <TwoColumnGrid
                  items={products}
                  keyOf={(product) => product.id}
                  renderItem={(product) => (
                    <ProductCard
                      tone="outlined"
                      showMarket={false}
                      product={product}
                      favorited={isFavorite(product.id)}
                      quantityInCart={quantityOf(product.id)}
                      onToggleFavorite={() => toggleFavorite(product.id)}
                      onAdd={() => addToCart(product.id)}
                    />
                  )}
                />
              )}
            </>
          ) : null}

          {tab === 'avaliacoes' ? (
            reviews.length === 0 ? (
              <EmptyState
                compact
                icon="star.fill"
                title="Sem avaliações ainda"
                subtitle="Seja o primeiro a avaliar esse mercado."
              />
            ) : (
              <>
                <View style={styles.ratingSummary}>
                  <View style={styles.ratingSummaryLeft}>
                    <Text style={styles.ratingBig}>{market.rating.toFixed(1)}</Text>
                    <StarRating rating={market.rating} size={14} />
                    <Text style={styles.ratingCount}>{pluralize(reviews.length, 'avaliação', 'avaliações')}</Text>
                  </View>
                  <View style={styles.ratingBars}>
                    {([5, 4, 3, 2, 1] as const).map((star) => (
                      <View
                        key={star}
                        style={styles.ratingBarRow}
                        accessible
                        accessibilityLabel={`${star} estrelas: ${pluralize(distribution[star], 'avaliação', 'avaliações')}`}>
                        <Text style={styles.ratingBarLabel}>{star}</Text>
                        <View style={styles.ratingBarTrack}>
                          <View
                            style={[styles.ratingBarFill, { width: `${(distribution[star] / maxDistributionCount) * 100}%` }]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeaderRow}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>{initials(review.name)}</Text>
                      </View>
                      <View style={styles.reviewInfo}>
                        <Text style={styles.reviewName}>{review.name}</Text>
                        <View style={styles.reviewMetaRow}>
                          <StarRating rating={review.rating} size={11} />
                          <Text style={styles.reviewTime}>{review.relativeTime}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  </View>
                ))}
              </>
            )
          ) : null}

          {tab === 'sobre' ? (
            <View style={styles.aboutCard}>
              <Text style={styles.aboutDescription}>{market.description}</Text>
              <View style={styles.aboutRow}>
                <IconSymbol name="location.fill" size={16} color={COLORS.navy} />
                <Text style={styles.aboutText}>{market.address}</Text>
              </View>
              <View style={styles.aboutRow}>
                <IconSymbol name="storefront.fill" size={16} color={COLORS.navy} />
                <Text style={styles.aboutText}>{market.category}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

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
  hero: {
    width: '100%',
    height: 300,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.heroShade,
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
    alignItems: 'center',
    gap: 14,
  },
  titleAvatar: {
    width: 58,
    height: 58,
    borderRadius: 16,
  },
  titleInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  marketName: {
    color: COLORS.navy,
    fontSize: 22,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    flexShrink: 1,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
  },
  openBadge: {
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  openBadgeText: {
    color: COLORS.success,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.medium,
    paddingVertical: 12,
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  statLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  catalogFilters: {
    gap: SPACING.sm,
  },
  categoryRow: {
    gap: 8,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  ratingSummaryLeft: {
    alignItems: 'center',
    gap: 4,
  },
  ratingBig: {
    color: COLORS.navy,
    fontSize: 44,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: -0.9,
  },
  ratingCount: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  ratingBars: {
    flex: 1,
    gap: 6,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBarLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.semibold,
    width: 10,
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.navy,
  },
  reviewCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.large,
    padding: 14,
    gap: 10,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  reviewInfo: {
    flex: 1,
    gap: 3,
  },
  reviewName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewTime: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
  },
  reviewComment: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.label,
    lineHeight: 20,
  },
  aboutCard: {
    gap: 14,
  },
  aboutDescription: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.body,
    lineHeight: 22,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
