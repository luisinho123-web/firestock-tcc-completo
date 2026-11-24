import { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, MAX_CONTENT_WIDTH, SPACING } from '@/components/ui/theme';
import { useCart } from '@/contexts/cart-context';

type TabMeta = { label: string; icon: IconSymbolName };

/** Keyed by route name inside app/(tabs). The cart is rendered as the raised center button. */
const TAB_META: Record<string, TabMeta> = {
  home: { label: 'Início', icon: 'house.fill' },
  markets: { label: 'Mercados', icon: 'storefront.fill' },
  cart: { label: 'Carrinho', icon: 'cart.fill' },
  orders: { label: 'Pedidos', icon: 'shippingbox.fill' },
  profile: { label: 'Perfil', icon: 'person.fill' },
};

const CART_ROUTE = 'cart';

/** Android resizes the window when the keyboard opens, which would float the tab bar above it. */
function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

/** Custom tab bar for app/(tabs)/_layout.tsx. */
export function BottomNav({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { totalItems } = useCart();
  const keyboardVisible = useKeyboardVisible();

  if (keyboardVisible) return null;

  const handlePress = (routeKey: string, isFocused: boolean) => {
    const event = emitter.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigateToTab(routeKey);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
      <View style={styles.row} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const isFocused = state.index === index;
        const onPress = () => handlePress(route.key, isFocused);

        if (route.name === CART_ROUTE) {
          const badge = totalItems > 9 ? '9+' : String(totalItems);
          return (
            <View key={route.key} style={styles.cartSlot}>
              <PressableScale
                style={styles.cartButton}
                onPress={onPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={totalItems > 0 ? `${meta.label}, ${totalItems} itens` : meta.label}>
                <IconSymbol name={meta.icon} size={22} color={COLORS.onDark} />
                {totalItems > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{badge}</Text>
                  </View>
                ) : null}
              </PressableScale>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                {meta.label}
              </Text>
            </View>
          );
        }

        return (
          <PressableScale
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={meta.label}>
            <View style={[styles.iconPill, isFocused && styles.iconPillActive]}>
              <IconSymbol name={meta.icon} size={20} color={isFocused ? COLORS.navy : COLORS.textTertiary} />
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
              {meta.label}
            </Text>
          </PressableScale>
        );
      })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
  },
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconPill: {
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 16,
  },
  iconPillActive: {
    backgroundColor: COLORS.primarySoft,
  },
  tabLabel: {
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.medium,
    // textTertiary, not textFaint: inactive labels are real text and must stay legible (WCAG AA).
    color: COLORS.textTertiary,
  },
  tabLabelActive: {
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.navy,
  },
  cartSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  cartButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.navy,
    borderWidth: 4,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.25,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: COLORS.orange,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
