import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONT_SIZES, FONT_WEIGHTS, TYPOGRAPHY } from '@/components/ui/theme';

/** Section title with an optional text action on the right. The action only renders when it does
 * something — a link-styled label that can't be tapped reads as broken. */
export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    ...TYPOGRAPHY.sectionTitle,
    flexShrink: 1,
  },
  action: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
