import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS, FONT_WEIGHTS, RADIUS, SIZES, SPACING, TYPOGRAPHY } from '@/components/ui/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'outlineInverse';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconSymbolName;
  iconPosition?: 'leading' | 'trailing';
  /** Right-aligned content, e.g. the order total on a "Confirmar pedido" button. */
  trailing?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  size?: 'regular' | 'compact';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const VARIANTS: Record<ButtonVariant, { container: ViewStyle; text: string }> = {
  primary: { container: { backgroundColor: COLORS.navy }, text: COLORS.onDark },
  secondary: { container: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }, text: COLORS.navy },
  ghost: { container: { backgroundColor: 'transparent' }, text: COLORS.navy },
  danger: { container: { backgroundColor: 'transparent' }, text: COLORS.error },
  inverse: { container: { backgroundColor: COLORS.surface }, text: COLORS.navy },
  outlineInverse: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.onDarkSubtle },
    text: COLORS.onDark,
  },
};

/** The app's one button. Every full-width call to action goes through here so height, radius, type
 * and pressed/disabled/loading feedback are identical everywhere. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'leading',
  trailing,
  loading = false,
  disabled = false,
  size = 'regular',
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const isInactive = disabled || loading;

  return (
    <PressableScale
      style={[styles.base, size === 'compact' && styles.compact, trailing ? styles.spread : null, palette.container, style]}
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading }}>
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          <View style={styles.labelRow}>
            {icon && iconPosition === 'leading' ? <IconSymbol name={icon} size={20} color={palette.text} /> : null}
            <Text
              style={[styles.label, size === 'compact' && styles.labelCompact, { color: palette.text }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {label}
            </Text>
            {icon && iconPosition === 'trailing' ? <IconSymbol name={icon} size={20} color={palette.text} /> : null}
          </View>
          {trailing}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: SIZES.buttonHeight,
    borderRadius: RADIUS.medium,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: SIZES.touchTarget,
    borderRadius: RADIUS.small,
    paddingHorizontal: SPACING.md,
  },
  spread: {
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 1,
  },
  label: {
    ...TYPOGRAPHY.button,
  },
  labelCompact: {
    fontSize: 14,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
