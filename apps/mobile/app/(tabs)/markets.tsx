import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING, TYPOGRAPHY } from '@/components/ui/theme';
import { useFavorites } from '@/contexts/favorites-context';
import { PARTNERS, type Partner, type PartnerKind } from '@/data/partners';
import { formatCurrency } from '@/utils/currency';
import { formatMinutesRange, normalizeSearch } from '@/utils/format';
import { useCatalogRefreshControl, useCatalogVersion } from '@/contexts/catalog-context';
import { formatDistance } from '@/services/distance-core';

type FilterKey = 'todos' | 'mercados' | 'restaurantes';

const FILTERS: { key: FilterKey; label: string; icon?: IconSymbolName }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'mercados', label: 'Mercados', icon: 'storefront.fill' },
  { key: 'restaurantes', label: 'Restaurantes', icon: 'fork.knife' },
];

const FILTER_TO_KIND: Partial<Record<FilterKey, PartnerKind>> = {
  mercados: 'mercado',
  restaurantes: 'restaurante',
};

const deliveryLabel = (partner: Partner) => formatMinutesRange(partner.deliveryMinMinutes, partner.deliveryMaxMinutes);

const feeLabel = (partner: Partner) => (partner.deliveryFee === 0 ? 'Frete grátis' : formatCurrency(partner.deliveryFee));

function partnerSummary(partner: Partner): string {
  return `${partner.name}, ${partner.category}, nota ${partner.rating.toFixed(1)}, ${formatDistance(partner.distanceKm)}, entrega em ${deliveryLabel(partner)}, ${feeLabel(partner)}`;
}

export default function MarketsScreen() {
  useCatalogVersion();
  const refreshControl = useCatalogRefreshControl();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('todos');

  const kind = FILTER_TO_KIND[filter];
  const term = normalizeSearch(search);
  const filtered = PARTNERS.filter((partner) => {
    const matchesKind = kind ? partner.kind === kind : true;
    return matchesKind && normalizeSearch(partner.name).includes(term);
  });

  // With no filter the market carousel is a curated "destaques" row; filtering to markets lists them all.
  const markets = filtered.filter((partner) => partner.kind === 'mercado' && (filter === 'mercados' || partner.featured));
  const restaurants = filtered.filter((partner) => partner.kind === 'restaurante');
  const hasResults = markets.length > 0 || restaurants.length > 0;

  return (
    <View style={styles.page}>
      <ScreenContainer>
        <ScrollView
          refreshControl={refreshControl}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.md }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Mercados parceiros
            </Text>
            <View style={styles.locationRow}>
              <IconSymbol name="location.fill" size={14} color={COLORS.orange} />
              <Text style={styles.locationText}>{PARTNERS.length} parceiros perto de você</Text>
            </View>
          </View>

          <SearchField value={search} onChangeText={setSearch} placeholder="Buscar mercado ou restaurante" />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {FILTERS.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                icon={item.icon}
                selected={filter === item.key}
                onPress={() => setFilter(item.key)}
              />
            ))}
          </ScrollView>

          {!hasResults ? (
            <EmptyState
              compact
              icon="storefront.fill"
              title="Nenhum parceiro encontrado"
              subtitle="Tente buscar por outro nome ou trocar o filtro."
              actionLabel={term || filter !== 'todos' ? 'Limpar filtros' : undefined}
              onAction={() => {
                setSearch('');
                setFilter('todos');
              }}
            />
          ) : null}

          {markets.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={filter === 'mercados' ? 'Mercados' : 'Mercados em destaque'} />
              <FlatList
                data={markets}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.marketList}
                renderItem={({ item }) => (
                  <MarketCard partner={item} favorited={isFavorite(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} />
                )}
              />
            </View>
          ) : null}

          {restaurants.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Restaurantes" />
              <View style={styles.restaurantList}>
                {restaurants.map((partner) => (
                  <RestaurantRow
                    key={partner.id}
                    partner={partner}
                    favorited={isFavorite(partner.id)}
                    onToggleFavorite={() => toggleFavorite(partner.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

function FavoriteToggle({ partner, favorited, onPress }: { partner: Partner; favorited: boolean; onPress: () => void }) {
  return (
    <PressableScale
      style={styles.favoriteButton}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: favorited }}
      accessibilityLabel={favorited ? `Remover ${partner.name} dos favoritos` : `Favoritar ${partner.name}`}>
      <IconSymbol name="heart.fill" size={18} color={favorited ? COLORS.error : COLORS.muted} />
    </PressableScale>
  );
}

function MarketCard({
  partner,
  favorited,
  onToggleFavorite,
}: {
  partner: Partner;
  favorited: boolean;
  onToggleFavorite: () => void;
}) {
  const router = useRouter();

  // Favorite toggle is a sibling overlay, not a child of the card's pressable (see ProductCard).
  return (
    <View style={styles.marketCard}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={partnerSummary(partner)}
        onPress={() => router.push({ pathname: '/market/[id]', params: { id: partner.id } })}>
        <Image source={partner.image} style={styles.marketImage} contentFit="cover" transition={150} />
        <View style={styles.marketBody}>
          <View style={styles.marketTitleRow}>
            <Text style={styles.marketName} numberOfLines={1}>
              {partner.name}
            </Text>
            <View style={[styles.badge, partner.deliveryFee === 0 ? styles.badgeSuccess : styles.badgeNeutral]}>
              <Text style={[styles.badgeText, partner.deliveryFee === 0 ? styles.badgeTextSuccess : styles.badgeTextNeutral]}>
                {feeLabel(partner)}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <IconSymbol name="star.fill" size={14} color={COLORS.warning} />
            <Text style={styles.metaStrong}>{partner.rating.toFixed(1)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{formatDistance(partner.distanceKm)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{deliveryLabel(partner)}</Text>
          </View>
        </View>
      </PressableScale>
      <View style={styles.marketFavorite}>
        <FavoriteToggle partner={partner} favorited={favorited} onPress={onToggleFavorite} />
      </View>
    </View>
  );
}

function RestaurantRow({
  partner,
  favorited,
  onToggleFavorite,
}: {
  partner: Partner;
  favorited: boolean;
  onToggleFavorite: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.restaurantRow}>
      <PressableScale
        style={styles.restaurantMain}
        accessibilityRole="button"
        accessibilityLabel={partnerSummary(partner)}
        onPress={() => router.push({ pathname: '/market/[id]', params: { id: partner.id } })}>
        <Image source={partner.image} style={styles.restaurantImage} contentFit="cover" transition={150} />
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {partner.name}
          </Text>
          <Text style={styles.restaurantCategory} numberOfLines={1}>
            {partner.category}
          </Text>
          <View style={styles.metaRow}>
            <IconSymbol name="star.fill" size={14} color={COLORS.warning} />
            <Text style={styles.metaStrong}>{partner.rating.toFixed(1)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{deliveryLabel(partner)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText} numberOfLines={1}>
              {partner.deliveryFee === 0 ? 'Grátis' : formatCurrency(partner.deliveryFee)}
            </Text>
          </View>
        </View>
      </PressableScale>
      <FavoriteToggle partner={partner} favorited={favorited} onPress={onToggleFavorite} />
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
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  header: {
    gap: 4,
  },
  title: {
    ...TYPOGRAPHY.pageTitle,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.body,
  },
  chipsRow: {
    gap: SPACING.xs,
  },
  section: {
    gap: SPACING.sm,
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketFavorite: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
  },
  marketList: {
    gap: 14,
  },
  marketCard: {
    width: 250,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    overflow: 'hidden',
  },
  marketImage: {
    width: 250,
    height: 132,
    backgroundColor: COLORS.border,
  },
  marketBody: {
    padding: 14,
    gap: 6,
  },
  marketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  marketName: {
    flex: 1,
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.bold,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  badgeSuccess: {
    backgroundColor: COLORS.successSoft,
  },
  badgeNeutral: {
    backgroundColor: COLORS.primarySoft,
  },
  badgeText: {
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  badgeTextSuccess: {
    color: COLORS.success,
  },
  badgeTextNeutral: {
    color: COLORS.navy,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaStrong: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  metaDot: {
    color: COLORS.textFaint,
    fontSize: FONT_SIZES.label,
  },
  metaText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
  },
  restaurantList: {
    gap: 12,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: SPACING.sm,
  },
  restaurantMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  restaurantImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: COLORS.border,
  },
  restaurantInfo: {
    flex: 1,
    gap: 4,
  },
  restaurantName: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: FONT_WEIGHTS.bold,
  },
  restaurantCategory: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
  },
});
