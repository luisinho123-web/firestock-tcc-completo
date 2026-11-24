import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { MAX_CONTENT_WIDTH } from './theme';

/** `fill` false makes the container hug its content instead of expanding — required when it sits inside an auto-height parent, where `flex: 1` collapses the parent on Yoga. */
export function ScreenContainer({
  children,
  style,
  fill = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fill?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isWide = width > MAX_CONTENT_WIDTH;

  return (
    <View style={[styles.outer, fill && styles.fill]}>
      <View style={[styles.inner, fill && styles.fill, isWide && { maxWidth: MAX_CONTENT_WIDTH, width: '100%' }, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    width: '100%',
  },
  inner: {
    width: '100%',
  },
  fill: {
    flex: 1,
  },
});
