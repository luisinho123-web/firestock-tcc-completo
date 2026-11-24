import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS, FONT_WEIGHTS, RADIUS, SIZES } from '@/components/ui/theme';

type GoogleButtonProps = {
  onPress?: () => void;
  loading?: boolean;
};

export function GoogleButton({ onPress, loading = false }: GoogleButtonProps) {
  return (
    <PressableScale
      style={styles.button}
      android_ripple={{ color: 'rgba(15, 23, 42, 0.08)' }}
      onPress={loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      accessibilityLabel="Continuar com Google">
      <View style={styles.content}>
        <Image source={require('@/assets/icons/icon-google.png')} style={styles.icon} contentFit="contain" accessible={false} />
        <Text style={styles.text}>{loading ? 'Abrindo o Google…' : 'Continuar com Google'}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: SIZES.buttonHeight,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  icon: {
    width: 20,
    height: 20,
  },
  text: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
