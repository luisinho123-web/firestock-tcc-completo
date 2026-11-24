import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { IconButton } from '@/components/ui/icon-button';
import { SIZES, SPACING, TYPOGRAPHY } from '@/components/ui/theme';

/** Standard top bar: back button, centered title, optional right action. The empty slots are sized
 * like an icon button so the title stays optically centered whether or not there's an action. */
export function ScreenHeader({
  title,
  onBack,
  showBack = true,
  right,
  style,
}: {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/home')));

  return (
    <View style={[styles.row, style]}>
      {showBack ? (
        <IconButton icon="chevron.left" accessibilityLabel="Voltar" onPress={handleBack} />
      ) : (
        <View style={styles.slot} />
      )}
      {title ? (
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}
      {right ?? <View style={styles.slot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    minHeight: SIZES.iconButton,
  },
  title: {
    ...TYPOGRAPHY.screenTitle,
    flex: 1,
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  slot: {
    width: SIZES.iconButton,
  },
});
