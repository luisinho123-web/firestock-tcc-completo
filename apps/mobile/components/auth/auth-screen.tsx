import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ui/screen-container';
import { COLORS, SPACING } from '@/components/ui/theme';

type AuthScreenProps = {
  children: ReactNode;
  /** Centers short content vertically instead of anchoring it to the top. Falls back to normal top-down scrolling on small screens or when the keyboard is open, since it's driven by flexbox, not a fixed offset. */
  centered?: boolean;
};

// No Android com edge-to-edge (app.json) o sistema NÃO redimensiona a janela quando o teclado abre, então sem 'padding' o
// teclado cobre os campos. 'padding' empurra o conteúdo para cima nas duas plataformas.
export function AuthScreen({ children, centered }: AuthScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <ScreenContainer
            style={[
              styles.content,
              { paddingTop: insets.top + SPACING.xl, paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xs },
              centered && [styles.contentCentered, { paddingTop: Math.max(insets.top, SPACING.xl) }],
            ]}>
            {children}
          </ScreenContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  contentCentered: {
    justifyContent: 'center',
  },
});
