import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '@/components/ui/theme';

export function BackLink({ label = 'Voltar para o login', onPress }: { label?: string; onPress?: () => void }) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.button}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/login')))}
      hitSlop={8}
      accessibilityRole="button">
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  text: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.bodySmall,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
