import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '@/components/ui/theme';

type EmptyStateProps = {
  icon: IconSymbolName;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Smaller version for "no results" inside a list, where the full-page treatment is too loud. */
  compact?: boolean;
};

export function EmptyState({ icon, title, subtitle, actionLabel, onAction, compact = false }: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]} accessibilityRole="summary">
      <View style={[styles.icon, compact && styles.iconCompact]}>
        <IconSymbol name={icon} size={compact ? 22 : 28} color={compact ? COLORS.navy : COLORS.onDark} />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} size="compact" style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  containerCompact: {
    paddingVertical: SPACING.xl,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  iconCompact: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.h1,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: FONT_SIZES.subtitle,
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.body,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  action: {
    width: 'auto',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
});
