import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';

export type SegmentOption<K extends string> = { key: K; label: string; count?: number };

/** Tab-like switch between views of the same screen. `tone="onSurface"` is for white sheets (grey
 * track, white thumb); the default sits on grey pages (white track, navy thumb). */
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
  tone = 'onBackground',
}: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  tone?: 'onBackground' | 'onSurface';
}) {
  const light = tone === 'onSurface';

  return (
    <View style={[styles.track, light && styles.trackLight]} accessibilityRole="tablist">
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <PressableScale
            key={option.key}
            style={[styles.segment, isActive && (light ? styles.segmentActiveLight : styles.segmentActive)]}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={option.count !== undefined ? `${option.label}, ${option.count}` : option.label}>
            <Text style={[styles.label, isActive && (light ? styles.labelActiveLight : styles.labelActive)]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <View style={[styles.badge, isActive && !light && styles.badgeActive]}>
                <Text style={[styles.badgeText, isActive && !light && styles.badgeTextActive]}>{option.count}</Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.input,
    padding: 4,
  },
  trackLight: {
    backgroundColor: COLORS.background,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xxs,
    minHeight: 40,
    paddingVertical: 4,
    borderRadius: 11,
    paddingHorizontal: SPACING.xs,
  },
  segmentActive: {
    backgroundColor: COLORS.navy,
  },
  segmentActiveLight: {
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
    flexShrink: 1,
  },
  labelActive: {
    color: COLORS.onDark,
    fontWeight: FONT_WEIGHTS.bold,
  },
  labelActiveLight: {
    color: COLORS.navy,
    fontWeight: FONT_WEIGHTS.bold,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  badgeTextActive: {
    color: COLORS.onDark,
  },
});
