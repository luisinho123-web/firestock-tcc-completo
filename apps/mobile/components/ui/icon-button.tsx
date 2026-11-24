import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS, SIZES } from '@/components/ui/theme';

type IconButtonProps = {
  icon: IconSymbolName;
  /** Required: an icon alone gives screen-reader users nothing to go on. */
  accessibilityLabel: string;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  size = SIZES.iconButton,
  iconSize = 20,
  color = COLORS.navy,
  disabled,
  style,
}: IconButtonProps) {
  // Keep the tappable area at least 44pt even when the visual circle is smaller.
  const slop = Math.max(0, (SIZES.touchTarget - size) / 2);

  return (
    <PressableScale
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }, style]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <IconSymbol name={icon} size={iconSize} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
