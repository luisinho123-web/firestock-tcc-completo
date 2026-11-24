import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '@/components/ui/theme';
import { useAdoptSession } from '@/hooks/use-google-sign-in';
import { errorMessage } from '@/services/auth';
import { completeOAuthFromUrl } from '@/services/google-auth';

/** Volta do login com o Google (web e app): lê os dados da URL, abre a sessão e entra no app. */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const adoptSession = useAdoptSession();
  const linkingUrl = Linking.useLinkingURL();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    // Na web a URL do retorno é a da própria página; no app ela chega pelo link profundo.
    const url = Platform.OS === 'web' ? window.location.href : linkingUrl;
    if (!url) return;
    started.current = true;

    (async () => {
      try {
        const done = await completeOAuthFromUrl(url);
        if (!done || !(await adoptSession())) setError('Não foi possível concluir o login com o Google. Tente novamente.');
      } catch (e) {
        setError(errorMessage(e, 'Não foi possível concluir o login com o Google.'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkingUrl]);

  if (error) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Não foi possível entrar</Text>
        <Text style={styles.message}>{error}</Text>
        <AuthPrimaryButton label="Voltar para o login" onPress={() => router.replace('/login')} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ActivityIndicator color={COLORS.navy} size="large" />
      <Text style={styles.message}>Entrando com o Google…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.surface },
  title: { color: COLORS.navy, fontSize: FONT_SIZES.h1, fontWeight: FONT_WEIGHTS.heavy },
  message: { color: COLORS.textTertiary, fontSize: FONT_SIZES.body, textAlign: 'center' },
});
