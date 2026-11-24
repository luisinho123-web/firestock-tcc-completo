import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SIZES, SPACING } from '@/components/ui/theme';
import { TwoColumnGrid } from '@/components/ui/two-column-grid';
import { useAddresses } from '@/contexts/addresses-context';
import { useCart } from '@/contexts/cart-context';
import { useFavorites } from '@/contexts/favorites-context';
import { useNotifications } from '@/contexts/notifications-context';
import { useProfile } from '@/contexts/profile-context';
import { PARTNERS } from '@/data/partners';
import { PRODUCTS, type ProductCategory } from '@/data/products';
import { useGuardedAddToCart } from '@/hooks/use-guarded-add-to-cart';
import { formatCurrency } from '@/utils/currency';
import { firstName, initials, normalizeSearch } from '@/utils/format';
import { useCatalogRefreshControl, useCatalogVersion } from '@/contexts/catalog-context';

type CategoryKey = ProductCategory | 'Todas';

const CATEGORIES: { key: CategoryKey; label: string; icon: IconSymbolName }[] = [
  { key: 'Frutas', label: 'Frutas', icon: 'basket.fill' },
  { key: 'Verduras', label: 'Verduras', icon: 'leaf.fill' },
  { key: 'Legumes', label: 'Legumes', icon: 'carrot.fill' },
  { key: 'Bebidas', label: 'Bebidas', icon: 'cup.and.saucer.fill' },
  { key: 'Todas', label: 'Todas', icon: 'square.grid.2x2.fill' },
];


export default function HomeScreen() {
  useCatalogVersion();
  const refreshControl = useCatalogRefreshControl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name, avatarUrl } = useProfile();
  const { selectedAddress } = useAddresses();
  const { unreadCount } = useNotifications();
  const { quantityOf } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToCart, modal } = useGuardedAddToCart();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryKey>('Frutas');

  const greetingName = firstName(name);
  // Destaque só para empresa que realmente oferece frete grátis a partir de um valor.
  const featuredMarket = PARTNERS.find((partner) => partner.freeDeliveryMinOrder > 0);

  const term = normalizeSearch(search);
  const filteredProducts = PRODUCTS.filter((product) => {
    const matchesCategory = category === 'Todas' || product.category === category;
    return matchesCategory && normalizeSearch(product.title).includes(term);
  });

  const sectionTitle = category === 'Todas' ? 'Mais vendidos' : `${category} mais vendidas`;

  const submitSearch = () => {
    if (term) router.push({ pathname: '/search', params: { q: search.trim() } });
  };

  return (
    <View style={styles.page}>
      <ScreenContainer>
        <ScrollView
          refreshControl={refreshControl}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.md }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={styles.greetingRow}>
              <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>{initials(name) || '?'}</Text>
                )}
              </View>
              <View style={styles.greetingText}>
                <Text style={styles.greeting} numberOfLines={1} accessibilityRole="header">
                  {greetingName ? `Olá, ${greetingName}!` : 'Olá!'}
                </Text>
                <PressableScale
                  style={styles.locationRow}
                  onPress={() => router.push('/addresses')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Entregar em ${selectedAddress?.street ?? 'endereço não definido'}`}
                  accessibilityHint="Abre seus endereços para trocar">
                  <IconSymbol name="location.fill" size={14} color={COLORS.orange} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {selectedAddress ? `${selectedAddress.street}, ${selectedAddress.number}` : 'Adicionar endereço'}
                  </Text>
                  <IconSymbol name="chevron.down" size={14} color={COLORS.textTertiary} />
                </PressableScale>
              </View>
            </View>
            <PressableScale
              style={styles.bellButton}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
              onPress={() => router.push('/notifications')}>
              <IconSymbol name="bell.fill" size={20} color={COLORS.navy} />
              {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
            </PressableScale>
          </View>

          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar frutas, bebidas, marcas..."
            onSubmitEditing={submitSearch}
          />

          {featuredMarket ? (
            <PressableScale
              style={styles.promoBanner}
              onPress={() => router.push({ pathname: '/market/[id]', params: { id: featuredMarket.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${featuredMarket.name}: frete grátis acima de ${formatCurrency(
                featuredMarket.freeDeliveryMinOrder
              )}`}
              accessibilityHint="Abre o mercado">
              <View style={styles.promoGlowLarge} />
              <View style={styles.promoGlowSmall} />
              <Image
                source={require('@/assets/products/cart-illustration.png')}
                style={styles.promoImage}
                contentFit="contain"
                accessible={false}
              />
              <View style={styles.promoContent}>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>{featuredMarket.name.toUpperCase()}</Text>
                </View>
                <Text style={styles.promoTitle}>
                  Frete grátis acima de {formatCurrency(featuredMarket.freeDeliveryMinOrder).replace(',00', '')}
                </Text>
                <View style={styles.promoActionRow}>
                  <Text style={styles.promoAction}>Aproveitar</Text>
                  <IconSymbol name="chevron.right" size={14} color={COLORS.accent} />
                </View>
              </View>
            </PressableScale>
          ) : null}

          <View style={styles.categoriesRow} accessibilityRole="tablist">
            {CATEGORIES.map((item) => {
              const isActive = category === item.key;
              return (
                <PressableScale
                  key={item.key}
                  style={styles.categoryItem}
                  onPress={() => setCategory(item.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={item.label}>
                  <View style={[styles.categoryIcon, isActive && styles.categoryIconActive]}>
                    <IconSymbol name={item.icon} size={26} color={isActive ? COLORS.onDark : COLORS.navy} />
                  </View>
                  <Text
                    style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}>
                    {item.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <SectionHeader
            title={sectionTitle}
            actionLabel={category === 'Todas' ? undefined : 'Ver tudo'}
            onAction={() => setCategory('Todas')}
          />

          {filteredProducts.length === 0 ? (
            <EmptyState
              compact
              icon="basket.fill"
              title={term ? 'Nada encontrado' : 'Nenhum produto por aqui ainda'}
              subtitle={
                term ? `Não achamos "${search.trim()}" nesta categoria.` : 'Essa categoria ainda não tem itens no catálogo.'
              }
              actionLabel={term ? 'Buscar em todos os mercados' : 'Ver todas as categorias'}
              onAction={term ? submitSearch : () => setCategory('Todas')}
            />
          ) : (
            <TwoColumnGrid
              items={filteredProducts}
              keyOf={(product) => product.id}
              renderItem={(product) => (
                <ProductCard
                  product={product}
                  favorited={isFavorite(product.id)}
                  quantityInCart={quantityOf(product.id)}
                  onToggleFavorite={() => toggleFavorite(product.id)}
                  onAdd={() => addToCart(product.id)}
                />
              )}
            />
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
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  greetingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  greetingText: {
    flex: 1,
  },
  avatar: {
    width: SIZES.avatar,
    height: SIZES.avatar,
    borderRadius: SIZES.avatar / 2,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
  },
  greeting: {
    color: COLORS.navy,
    fontSize: 20,
    fontWeight: FONT_WEIGHTS.heavy,
    letterSpacing: -0.1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 2,
    maxWidth: '100%',
  },
  locationText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
    flexShrink: 1,
  },
  bellButton: {
    width: SIZES.iconButton,
    height: SIZES.iconButton,
    borderRadius: SIZES.iconButton / 2,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.orange,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  promoBanner: {
    minHeight: 150,
    borderRadius: 22,
    backgroundColor: COLORS.navy,
    overflow: 'hidden',
  },
  promoGlowLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.onDarkGlow,
    right: -80,
    top: -60,
  },
  promoGlowSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.onDarkGlow,
    right: -10,
    top: 70,
  },
  // Image and copy split the banner by percentage, so the title never runs under the illustration on
  // narrow phones (320dp) while keeping the original proportions at 390dp.
  promoImage: {
    position: 'absolute',
    width: '40%',
    height: 130,
    right: 10,
    top: 12,
  },
  promoContent: {
    padding: SPACING.lg,
    gap: SPACING.xs,
    width: '62%',
  },
  promoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.orange,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  promoBadgeText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  promoTitle: {
    color: COLORS.onDark,
    fontSize: 20,
    fontWeight: FONT_WEIGHTS.heavy,
    lineHeight: 26,
  },
  promoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoAction: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  categoryItem: {
    flex: 1,
    maxWidth: 72,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  categoryIcon: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 64,
    borderRadius: RADIUS.large,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  categoryLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.medium,
  },
  categoryLabelActive: {
    color: COLORS.navy,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
