import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS, SPACING } from '@/components/ui/theme';

export function Checkbox({
  checked,
  onChange,
  children,
  accessibilityLabel,
  hasError,
  style,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Label content rendered to the right of the box. */
  children: ReactNode;
  accessibilityLabel: string;
  hasError?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      style={[styles.row, style]}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}>
      <View style={[styles.box, hasError && styles.boxError, checked && styles.boxChecked]}>
        {checked ? <IconSymbol name="checkmark" size={14} color={COLORS.white} /> : null}
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxError: {
    borderColor: COLORS.error,
  },
  boxChecked: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
});
