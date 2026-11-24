import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { TwoColumnGrid } from '@/components/ui/two-column-grid';
import { useCart } from '@/contexts/cart-context';
import { useFavorites } from '@/contexts/favorites-context';
import { PARTNERS } from '@/data/partners';
import { PRODUCTS } from '@/data/products';
import { useGuardedAddToCart } from '@/hooks/use-guarded-add-to-cart';
import { useCatalogVersion } from '@/contexts/catalog-context';
import { formatDistance } from '@/services/distance-core';

type Tab = 'produtos' | 'mercados';

export default function FavoritesScreen() {
  useCatalogVersion();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const { quantityOf } = useCart();
  const { addToCart, modal } = useGuardedAddToCart();
  const [tab, setTab] = useState<Tab>('produtos');

  const favoriteProducts = PRODUCTS.filter((product) => favoriteIds.includes(product.id));
  const favoriteMarkets = PARTNERS.filter((partner) => favoriteIds.includes(partner.id));
  const bottomPadding = Math.max(insets.bottom, SPACING.md) + SPACING.lg;

  return (
    <View style={styles.page}>
      <ScreenContainer style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
        <ScreenHeader title="Favoritos" />

        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { key: 'produtos', label: 'Produtos', count: favoriteProducts.length },
            { key: 'mercados', label: 'Mercados', count: favoriteMarkets.length },
          ]}
        />

        {tab === 'produtos' ? (
          favoriteProducts.length === 0 ? (
            <EmptyState
              icon="heart.fill"
              title="Nenhum produto favorito"
              subtitle="Toque no coração de um produto para salvá-lo aqui."
              actionLabel="Explorar produtos"
              onAction={() => router.navigate('/home')}
            />
          ) : (
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
              showsVerticalScrollIndicator={false}>
              <TwoColumnGrid
                items={favoriteProducts}
                keyOf={(product) => product.id}
                renderItem={(product) => (
                  <ProductCard
                    product={product}
                    favorited
                    quantityInCart={quantityOf(product.id)}
                    onToggleFavorite={() => toggleFavorite(product.id)}
                    onAdd={() => addToCart(product.id)}
                  />
                )}
                trailing={
                  <PressableScale style={styles.discoverCard} onPress={() => router.navigate('/home')} accessibilityRole="button">
                    <View style={styles.discoverIcon}>
                      <IconSymbol name="magnifyingglass" size={18} color={COLORS.navy} />
                    </View>
                    <Text style={styles.discoverText}>Descubra mais produtos</Text>
                  </PressableScale>
                }
              />
            </ScrollView>
          )
        ) : favoriteMarkets.length === 0 ? (
          <EmptyState
            icon="storefront.fill"
            title="Nenhum mercado favorito"
            subtitle="Toque no coração de um mercado para salvá-lo aqui."
            actionLabel="Explorar mercados"
            onAction={() => router.navigate('/markets')}
          />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
            showsVerticalScrollIndicator={false}>
            {favoriteMarkets.map((market) => (
              <View key={market.id} style={styles.marketRow}>
                <PressableScale
                  style={styles.marketMain}
                  onPress={() => router.push({ pathname: '/market/[id]', params: { id: market.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${market.name}, ${market.category}, nota ${market.rating.toFixed(
                    1
                  )}, ${formatDistance(market.distanceKm)}`}>
                  <Image source={market.image} style={styles.marketImage} contentFit="cover" />
                  <View style={styles.marketInfo}>
                    <Text style={styles.marketName} numberOfLines={1}>
                      {market.name}
                    </Text>
                    <Text style={styles.marketCategory} numberOfLines={1}>
                      {market.category}
                    </Text>
                    <View style={styles.marketMetaRow}>
                      <IconSymbol name="star.fill" size={13} color={COLORS.warning} />
                      <Text style={styles.marketMetaText}>{market.rating.toFixed(1)}</Text>
                      <Text style={styles.marketMetaDot}>·</Text>
                      <Text style={styles.marketMetaText}>{formatDistance(market.distanceKm)}</Text>
                    </View>
                  </View>
                </PressableScale>
                <PressableScale
                  style={styles.unfavoriteButton}
                  onPress={() => toggleFavorite(market.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${market.name} dos favoritos`}>
                  <IconSymbol name="heart.fill" size={20} color={COLORS.error} />
                </PressableScale>
              </View>
            ))}
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
  container: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  scrollContent: {
    paddingTop: SPACING.xs,
    gap: SPACING.sm,
  },
  discoverCard: {
    flex: 1,
    minHeight: 200,
    borderRadius: RADIUS.large,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 10,
  },
  discoverIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
    textAlign: 'center',
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: SPACING.sm,
  },
  marketMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  unfavoriteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  marketInfo: {
    flex: 1,
    gap: 2,
  },
  marketName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  marketCategory: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  marketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  marketMetaText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  marketMetaDot: {
    color: COLORS.textFaint,
  },
});
