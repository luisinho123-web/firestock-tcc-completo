import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { dismissToast, getCurrentToast, subscribeToToasts, type ToastType } from '@/components/ui/toast';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';

const TONE: Record<ToastType, { background: string; text: string; icon: 'checkmark' | 'xmark' | 'bell.fill' }> = {
  success: { background: COLORS.success, text: COLORS.white, icon: 'checkmark' },
  error: { background: COLORS.error, text: COLORS.white, icon: 'xmark' },
  info: { background: COLORS.navy, text: COLORS.white, icon: 'bell.fill' },
};

/** Desenha o aviso atual (ver components/ui/toast.ts) por cima de tudo, no topo da tela. */
export function ToastHost() {
  const current = useSyncExternalStore(subscribeToToasts, getCurrentToast, () => null);
  const insets = useSafeAreaInsets();
  if (!current) return null;

  const tone = TONE[current.type];
  return (
    <View style={[styles.region, { top: insets.top + SPACING.sm }]} pointerEvents="box-none">
      <Pressable
        onPress={() => dismissToast(current.id)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${current.text}. Toque para fechar.`}
        style={[styles.toast, { backgroundColor: tone.background }]}>
        <IconSymbol name={tone.icon} size={18} color={tone.text} />
        <Text style={[styles.text, { color: tone.text }]}>{current.text}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  region: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.input,
  },
  text: {
    flex: 1,
    fontSize: FONT_SIZES.bodySmall,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: 20,
  },
});
