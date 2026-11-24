import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ui/screen-container';
import { COLORS, SPACING } from '@/components/ui/theme';

// No Android com edge-to-edge (app.json) o sistema NÃO redimensiona a janela quando o teclado abre, então sem 'padding' o
// teclado cobre os campos. 'padding' empurra o conteúdo para cima nas duas plataformas.
/** Scrollable page for forms: keeps the focused field above the keyboard, keeps taps working while the
 * keyboard is open, and pins `footer` (the submit button) to the bottom on tall screens while letting
 * it scroll with the content on short ones. */
export function FormScreen({
  header,
  children,
  footer,
  background = COLORS.background,
}: {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  background?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: background }]}
      behavior="padding">
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACING.md, paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xs },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <ScreenContainer style={styles.inner}>
          {header}
          {children}
          {footer ? (
            <>
              <View style={styles.flex} />
              <View style={styles.footer}>{footer}</View>
            </>
          ) : null}
        </ScreenContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
  },
  inner: {
    gap: 0,
  },
  footer: {
    paddingTop: SPACING.lg,
    gap: SPACING.xs,
  },
});
