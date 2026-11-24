import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { WelcomeActions } from '@/components/welcome/welcome-actions';
import { WelcomeBanner } from '@/components/welcome/welcome-banner';
import { WelcomeIntro } from '@/components/welcome/welcome-intro';
import { getProduct } from '@/data/products';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { formatCurrency } from '@/utils/currency';

const SHOWCASE_PRODUCT_ID = 'banana-prata';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useStatusBarStyle('light');
  const showcase = getProduct(SHOWCASE_PRODUCT_ID);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} bounces={false} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <WelcomeBanner />

        <View style={[styles.deliveryBadge, { top: insets.top + SPACING.sm }]}>
          <IconSymbol name="bolt.fill" size={14} color={COLORS.onDark} />
          <Text style={styles.deliveryText}>Entrega em 20 min</Text>
        </View>

        {showcase ? (
          <View style={styles.priceBadge}>
            <View style={styles.priceBadgeIcon}>
              <IconSymbol name="leaf.fill" size={16} color={COLORS.onDark} />
            </View>
            <View>
              <Text style={styles.priceBadgeLabel}>{showcase.title}</Text>
              <Text style={styles.priceBadgeValue}>
                {formatCurrency(showcase.price)}/{showcase.unit}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, SPACING.lg) + SPACING.md }]}>
        <WelcomeIntro />
        <WelcomeActions onSignIn={() => router.push('/login')} onRegister={() => router.push('/register')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  content: {
    flexGrow: 1,
  },
  hero: {
    width: '100%',
  },
  deliveryBadge: {
    position: 'absolute',
    right: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  deliveryText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  priceBadge: {
    position: 'absolute',
    left: SPACING.xl,
    bottom: -22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.medium,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  priceBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBadgeLabel: {
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.textTertiary,
  },
  priceBadgeValue: {
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.heavy,
    color: COLORS.navy,
  },
  body: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: 44,
    justifyContent: 'space-between',
  },
});
