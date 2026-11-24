import { useState } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Keys that only make sense once: how this component sits among its siblings (flex, margin,
// position, z-index) and its own shadow. They must live on the outer Pressable — the actual flex
// participant — not the inner Animated.View. Applied to both, a negative marginTop or
// `position: absolute` offset would apply a second time relative to Pressable's own already-
// positioned box, rendering a visibly duplicated/offset copy of the button. `flex`/`flexBasis` is
// worse than redundant there: Animated.View would need Pressable to already have a resolved
// main-axis size to grow into, which it doesn't yet (that's what the flex is computing), and it
// collapses to ~0 instead.
//
// Fixed sizing (width/height and friends) and everything else — background, border, borderRadius,
// alignItems/justifyContent, gap, padding — stays duplicated on both: identical size and paint at
// an identical position is a no-op, and the inner copy is what actually paints the box and arranges
// this component's own children (e.g. an icon + label row), since Pressable auto-sizes to match it.
// Corner radii go on both: the inner view paints the rounded box, and the outer one needs the same
// radius so a shadow moved onto it (above) follows the rounded shape instead of a square.
const SHARED_KEYS = new Set([
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
]);

const OUTER_ONLY_KEYS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'start',
  'end',
  'alignSelf',
  'zIndex',
  'shadowColor',
  'shadowOpacity',
  'shadowRadius',
  'shadowOffset',
  'elevation',
]);

export function PressableScale({
  scaleTo = 0.97,
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  accessibilityState,
  ...props
}: PressableScaleProps) {
  // Lazy state initializer: one Animated.Value per mount, without reading a ref during render.
  const [scale] = useState(() => new Animated.Value(1));

  const animateTo = (value: number) => {
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  const flatStyle = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outerStyle: Record<string, unknown> = {};
  const innerStyle: Record<string, unknown> = {};
  Object.keys(flatStyle).forEach((key) => {
    if (SHARED_KEYS.has(key)) {
      outerStyle[key] = flatStyle[key];
      innerStyle[key] = flatStyle[key];
      return;
    }
    (OUTER_ONLY_KEYS.has(key) ? outerStyle : innerStyle)[key] = flatStyle[key];
  });

  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      style={outerStyle}
      onPressIn={(event) => {
        animateTo(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}>
      <Animated.View style={[innerStyle, disabled && styles.disabled, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
});
