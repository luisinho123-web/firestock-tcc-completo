import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS } from '@/components/ui/theme';

/** Read-only row of five stars. Announced as a single "Nota 4 de 5" instead of five unlabeled icons. */
export function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const filled = Math.round(rating);

  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={`Nota ${filled} de 5`}>
      {[1, 2, 3, 4, 5].map((position) => (
        <IconSymbol key={position} name="star.fill" size={size} color={position <= filled ? COLORS.warning : COLORS.border} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
  },
});
