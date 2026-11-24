import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { COLORS } from '@/components/ui/theme';

type AuthFooterLinkProps = {
  prompt: string;
  actionLabel: string;
  onPress: () => void;
};

export function AuthFooterLink({ prompt, actionLabel, onPress }: AuthFooterLinkProps) {
  return (
    <PressableScale style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={styles.prompt}>
        {prompt} <Text style={styles.action}>{actionLabel}</Text>
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'center',
    marginTop: 24,
  },
  prompt: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  action: {
    fontWeight: '700',
    color: COLORS.navy,
  },
});
