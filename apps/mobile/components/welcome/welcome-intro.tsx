import { StyleSheet, Text } from 'react-native';

import { COLORS, FONT_SIZES, FONT_WEIGHTS } from '@/components/ui/theme';

export function WelcomeIntro() {
  return (
    <>
      <Text style={styles.title} accessibilityRole="header">
        Suas compras de mercado, sem sair de casa
      </Text>
      <Text style={styles.subtitle}>Compare preços entre mercados parceiros, monte seu carrinho e receba tudo rapidinho.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FONT_SIZES.hero,
    fontWeight: FONT_WEIGHTS.heavy,
    lineHeight: 36,
    letterSpacing: -0.3,
    color: COLORS.onDark,
    width: '100%',
  },
  subtitle: {
    fontSize: FONT_SIZES.subtitle,
    lineHeight: 24,
    color: COLORS.onDarkMuted,
    width: '100%',
    marginTop: 12,
  },
});
