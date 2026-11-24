import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { COLORS } from '@/components/ui/theme';

/** Upper bound on how long the intro can cover the app, whatever happens to the animation. */
const MAX_VISIBLE_MS = 3000;

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const [scale] = useState(() => new Animated.Value(0.85));
  const [opacity] = useState(() => new Animated.Value(1));
  const finish = useEffectEvent(() => onFinish());

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    const safety = setTimeout(() => finish(), MAX_VISIBLE_MS);

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          finish();
          return;
        }
        animation = Animated.sequence([
          Animated.spring(scale, { toValue: 1, speed: 10, bounciness: 10, useNativeDriver: true }),
          Animated.delay(450),
          Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]);
        animation.start(() => finish());
      });

    return () => {
      cancelled = true;
      clearTimeout(safety);
      animation?.stop();
    };
  }, [scale, opacity]);

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <Animated.Image
        source={require('@/assets/images/splash-logo.png')}
        style={[styles.logo, { transform: [{ scale }] }]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  logo: {
    width: 220,
    height: 81,
  },
});
