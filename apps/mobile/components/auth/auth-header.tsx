import { StyleSheet, Text } from 'react-native';

import { COLORS, FONT_SIZES } from '@/components/ui/theme';

type AuthHeaderProps = {
  title: string;
  subtitle: string;
};

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FONT_SIZES.display,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.3,
    color: COLORS.navy,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textTertiary,
    marginBottom: 28,
  },
});
