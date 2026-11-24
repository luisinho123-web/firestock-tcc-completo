import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { SearchField } from '@/components/ui/search-field';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { TwoColumnGrid } from '@/components/ui/two-column-grid';
import { getPartner } from '@/data/partners';
import { PRODUCTS } from '@/data/products';
import { useFlash } from '@/hooks/use-flash';
import { useGuardedAddToCart } from '@/hooks/use-guarded-add-to-cart';
import { formatCurrency } from '@/utils/currency';
import { normalizeSearch as normalize, pluralize } from '@/utils/format';
import { sanitizeSearch } from '@/utils/sanitize';
import { useCatalogRefreshControl, useCatalogVersion } from '@/contexts/catalog-context';
import { formatDistance } from '@/services/distance-core';

type SortKey = 'preco' | 'perto' | 'avaliacao';

const SORT_CHIPS: { key: SortKey; label: string; icon: IconSymbolName }[] = [
  { key: 'preco', label: 'Menor preço', icon: 'percent' },
  { key: 'perto', label: 'Mais perto', icon: 'location.fill' },
  { key: 'avaliacao', label: 'Avaliação', icon: 'star.fill' },
];

export default function SearchScreen() {
  useCatalogVersion();
  const refreshControl = useCatalogRefreshControl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { addToCart, modal } = useGuardedAddToCart();
  const [query, setQuery] = useState(sanitizeSearch(q ?? ''));
  const [sortBy, setSortBy] = useState<SortKey>('preco');
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [justAdded, flashAdded] = useFlash();

  const term = normalize(query);
  const matches = term
    ? PRODUCTS.filter((product) => {
        if (!normalize(product.title).includes(term)) return false;
        return freeShippingOnly ? getPartner(product.marketId)?.deliveryFee === 0 : true;
      })
    : [];

  const sortedMatches = [...matches].sort((a, b) => {
    if (sortBy === 'preco') return a.price - b.price;
    const marketA = getPartner(a.marketId);
    const marketB = getPartner(b.marketId);
    if (sortBy === 'perto') return (marketA?.distanceKm ?? 1e9) - (marketB?.distanceKm ?? 1e9);
    return (marketB?.rating ?? 0) - (marketA?.rating ?? 0);
  });

  const bestPrice = matches.length > 0 ? matches.reduce((best, product) => (product.price < best.price ? product : best)) : null;
  const worstPrice = matches.length > 1 ? Math.max(...matches.map((product) => product.price)) : 0;
  const savingsPercent = bestPrice && worstPrice > 0 ? Math.round((1 - bestPrice.price / worstPrice) * 100) : 0;
  const marketCount = new Set(matches.map((product) => product.marketId)).size;
  const bestMarket = getPartner(bestPrice?.marketId);

  const handleAddBestPrice = () => {
    if (bestPrice && addToCart(bestPrice.id)) flashAdded();
  };

  return (
    <View style={styles.page}>
      <ScreenContainer>
        <ScrollView
          refreshControl={refreshControl}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + SPACING.md, paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.lg },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View style={styles.searchRow}>
            <IconButton
              icon="chevron.left"
              accessibilityLabel="Voltar"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
            />
            <SearchField
              tone="focused"
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar produto..."
              autoFocus={!q}
              style={styles.searchField}
            />
          </View>

          {term.length === 0 ? (
            <EmptyState
              icon="magnifyingglass"
              title="Busque um produto"
              subtitle="Compare o preço entre os mercados parceiros."
            />
          ) : (
            <>
              <Text style={styles.resultsCount} accessibilityLiveRegion="polite">
                {pluralize(matches.length, 'resultado', 'resultados')} em {pluralize(marketCount, 'mercado', 'mercados')}
              </Text>

              <View style={styles.chipsRow}>
                {SORT_CHIPS.map((chip) => (
                  <Chip
                    key={chip.key}
                    label={chip.label}
                    icon={chip.icon}
                    selected={sortBy === chip.key}
                    onPress={() => setSortBy(chip.key)}
                  />
                ))}
                <Chip
                  label="Frete grátis"
                  icon="truck.fill"
                  selected={freeShippingOnly}
                  onPress={() => setFreeShippingOnly((current) => !current)}
                />
              </View>

              {matches.length === 0 ? (
                <EmptyState
                  compact
                  icon="magnifyingglass"
                  title="Nenhum resultado encontrado"
                  subtitle={
                    freeShippingOnly
                      ? 'Nenhum mercado com frete grátis tem esse produto. Remova o filtro para ver todos.'
                      : 'Tente buscar por outro produto.'
                  }
                  actionLabel={freeShippingOnly ? 'Remover filtro' : undefined}
                  onAction={() => setFreeShippingOnly(false)}
                />
              ) : (
                <>
                  {bestPrice && bestMarket ? (
                    <PressableScale
                      style={styles.bestPriceCard}
                      onPress={handleAddBestPrice}
                      accessibilityRole="button"
                      accessibilityLabel={`Melhor preço: ${bestPrice.title}, ${formatCurrency(bestPrice.price)} por ${
                        bestPrice.unit
                      } no ${bestMarket.name}`}
                      accessibilityHint="Adiciona ao carrinho">
                      <View style={styles.bestPriceThumb}>
                        <Image source={bestPrice.image} style={styles.bestPriceImage} contentFit="contain" />
                      </View>
                      <View style={styles.bestPriceInfo}>
                        <Text style={styles.bestPriceLabel}>MELHOR PREÇO ENCONTRADO</Text>
                        <Text style={styles.bestPriceTitle}>
                          {bestPrice.title} · {formatCurrency(bestPrice.price)}/{bestPrice.unit}
                        </Text>
                        <Text style={styles.bestPriceSubtitle}>
                          {bestMarket.name}
                          {savingsPercent > 0 ? ` · economize até ${savingsPercent}%` : ''}
                        </Text>
                      </View>
                      <View style={styles.bestPriceAddButton}>
                        <IconSymbol name={justAdded ? 'checkmark' : 'plus'} size={20} color={COLORS.onDark} />
                      </View>
                    </PressableScale>
                  ) : null}

                  <TwoColumnGrid
                    items={sortedMatches}
                    keyOf={(product) => product.id}
                    renderItem={(product) => {
                      const market = getPartner(product.marketId);
                      if (!market) return null;
                      const isBest = product.id === bestPrice?.id;
                      return (
                        <PressableScale
                          style={styles.compareCard}
                          onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
                          accessibilityRole="button"
                          accessibilityLabel={`${product.title}, ${formatCurrency(product.price)} por ${product.unit}, ${
                            market.name
                          }, ${formatDistance(market.distanceKm)}${isBest ? ', menor preço' : ''}`}>
                          <View style={styles.compareMedia}>
                            <Image source={product.image} style={styles.compareImage} contentFit="contain" />
                            <Image source={market.image} style={styles.compareMarketAvatar} contentFit="cover" />
                            {isBest ? (
                              <View style={styles.bestBadge}>
                                <Text style={styles.bestBadgeText}>Menor preço</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.compareInfo}>
                            <View style={styles.comparePriceRow}>
                              <Text style={[styles.comparePrice, isBest && styles.comparePriceBest]}>
                                {formatCurrency(product.price)}
                              </Text>
                              <Text style={styles.compareUnit}>/{product.unit}</Text>
                            </View>
                            <Text style={styles.compareTitle} numberOfLines={1}>
                              {product.title}
                            </Text>
                            <View style={styles.compareMarketRow}>
                              <IconSymbol name="storefront.fill" size={12} color={COLORS.textTertiary} />
                              <Text style={styles.compareMarketText} numberOfLines={1}>
                                {market.name} · {formatDistance(market.distanceKm)}
                              </Text>
                            </View>
                          </View>
                        </PressableScale>
                      );
                    }}
                  />
                </>
              )}
            </>
          )}
        </ScrollView>
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
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  searchField: {
    flex: 1,
    height: 48,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultsCount: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.bold,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bestPriceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.large,
    padding: 14,
  },
  bestPriceThumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestPriceImage: {
    width: '80%',
    height: '80%',
  },
  bestPriceInfo: {
    flex: 1,
    gap: 3,
  },
  bestPriceLabel: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.micro,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.4,
  },
  bestPriceTitle: {
    color: COLORS.onDark,
    fontSize: 15,
    fontWeight: FONT_WEIGHTS.bold,
  },
  bestPriceSubtitle: {
    color: COLORS.onDarkMuted,
    fontSize: FONT_SIZES.small,
  },
  bestPriceAddButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 10,
    gap: 10,
  },
  compareMedia: {
    height: 118,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareImage: {
    width: '85%',
    height: '85%',
  },
  compareMarketAvatar: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: COLORS.onDark,
  },
  bestBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  bestBadgeText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  compareInfo: {
    paddingHorizontal: 4,
    gap: 2,
  },
  comparePriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  comparePrice: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  comparePriceBest: {
    color: COLORS.orange,
  },
  compareUnit: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  compareTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  compareMarketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compareMarketText: {
    flexShrink: 1,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
});
