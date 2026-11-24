import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ui/screen-container';
import { COLORS, RADIUS, SHADOW_BAR, SPACING } from '@/components/ui/theme';

/** Call-to-action bar pinned under a screen's scroll content. It sits in the layout flow (the screen is
 * a flex column: scroll view with `flex: 1`, then this bar), so content is never hidden behind it, and
 * it pads for the home indicator / Android navigation bar instead of assuming an iPhone's 34pt. */
export function BottomBar({
  children,
  style,
  elevated = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Rounded top corners + upward shadow. Off for bars that sit on a plain white page. */
  elevated?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, elevated && styles.elevated, { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xs }]}>
      <ScreenContainer fill={false} style={[styles.content, style]}>
        {children}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  elevated: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    ...SHADOW_BAR,
  },
  content: {
    gap: SPACING.sm,
  },
});
