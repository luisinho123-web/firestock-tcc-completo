import { StyleSheet, Text } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SIZES, SPACING } from '@/components/ui/theme';

/** Selectable filter/sort pill. `tone="filled"` is for use on white sheets (grey resting state). */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone = 'outlined',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconSymbolName;
  tone?: 'outlined' | 'filled';
}) {
  return (
    <PressableScale
      style={[styles.chip, tone === 'filled' ? styles.filled : styles.outlined, selected && styles.selected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}>
      {icon ? <IconSymbol name={icon} size={15} color={selected ? COLORS.onDark : COLORS.navy} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    minHeight: SIZES.chipHeight,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
  },
  outlined: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filled: {
    backgroundColor: COLORS.background,
  },
  selected: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  label: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  labelSelected: {
    color: COLORS.onDark,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
