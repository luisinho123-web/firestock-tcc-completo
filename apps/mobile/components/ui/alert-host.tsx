import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { dismissCurrentAlert, getCurrentAlert, subscribeToAlerts } from '@/components/ui/alert';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SIZES, SPACING } from '@/components/ui/theme';

/** Draws the alerts queued by `Alert.alert` on web (see components/ui/alert.ts). Renders nothing on native. */
export function AlertHost() {
  const current = useSyncExternalStore(subscribeToAlerts, getCurrentAlert, () => null);
  if (!current) return null;

  const cancel = current.buttons.find((button) => button.style === 'cancel');
  // Cancel goes last so the main action sits on top, like the native sheets.
  const buttons = [...current.buttons.filter((button) => button !== cancel), ...(cancel ? [cancel] : [])];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => dismissCurrentAlert(cancel)}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={styles.actions}>
            {buttons.map((button, index) => {
              const isCancel = button === cancel;
              const isDestructive = button.style === 'destructive';
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => dismissCurrentAlert(button)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.button,
                    isCancel ? styles.buttonCancel : isDestructive ? styles.buttonDestructive : styles.buttonPrimary,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.buttonText, isCancel ? styles.buttonTextCancel : styles.buttonTextOnColor]}>
                    {button.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.scrim,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: SPACING.lg,
    borderRadius: RADIUS.large,
    backgroundColor: COLORS.surface,
  },
  title: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.h2,
    fontWeight: FONT_WEIGHTS.bold,
  },
  message: {
    marginTop: SPACING.xs,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.body,
    lineHeight: 22,
  },
  actions: {
    marginTop: SPACING.lg,
    gap: SPACING.xs,
  },
  button: {
    minHeight: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.input,
    paddingHorizontal: SPACING.md,
  },
  buttonPrimary: {
    backgroundColor: COLORS.navy,
  },
  buttonDestructive: {
    backgroundColor: COLORS.error,
  },
  buttonCancel: {
    backgroundColor: COLORS.background,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
  },
  buttonTextOnColor: {
    color: COLORS.white,
  },
  buttonTextCancel: {
    color: COLORS.navy,
  },
});
