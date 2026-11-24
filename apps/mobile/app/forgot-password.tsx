import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { AuthHeader } from '@/components/auth/auth-header';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { AuthScreen } from '@/components/auth/auth-screen';
import { AuthTextField } from '@/components/auth/auth-text-field';
import { BackLink } from '@/components/auth/back-link';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS, FONT_SIZES, SPACING } from '@/components/ui/theme';
import { errorMessage, requestPasswordReset } from '@/services/auth';
import { INPUT_LIMITS, sanitizeEmail } from '@/utils/sanitize';
import { isValidEmail } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setEmailError('');

    if (!email.trim()) {
      setEmailError('Informe seu e-mail.');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('Digite um e-mail válido.');
      return;
    }

    try {
      setIsSubmitting(true);
      // The link in the e-mail brings the person back to the new-password screen (the URL must be listed
      // under Authentication → URL Configuration → Redirect URLs in Supabase).
      const redirectTo =
        Platform.OS === 'web' ? `${window.location.origin}/new-password` : Linking.createURL('/new-password');
      await requestPasswordReset(email.trim(), redirectTo);
      setSent(true);
    } catch (error) {
      setEmailError(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthScreen centered>
        <View style={styles.successIcon}>
          <IconSymbol name="envelope.fill" size={36} color={COLORS.onDark} />
        </View>

        <AuthHeader title="Verifique seu e-mail" subtitle={`Enviamos um link de recuperação para ${email.trim()}.`} />

        <Text style={styles.hintText}>
          Não recebeu o e-mail? Verifique sua caixa de spam ou tente novamente em alguns minutos.
        </Text>

        <AuthPrimaryButton label="Voltar para o login" onPress={() => router.dismissTo('/login')} />
        <BackLink label="Usar outro e-mail" onPress={() => setSent(false)} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen centered>
      <AuthHeader title="Recuperar senha" subtitle="Informe seu e-mail para receber o link de recuperação." />

      <AuthTextField
        label="E-mail"
        icon="envelope.fill"
        placeholder="seu@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={INPUT_LIMITS.email}
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        value={email}
        onChangeText={(value) => {
          setEmail(sanitizeEmail(value));
          if (emailError) setEmailError('');
        }}
        error={emailError}
      />

      <AuthPrimaryButton label="Enviar link" onPress={handleSubmit} loading={isSubmitting} />
      <BackLink />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.xl,
    shadowColor: COLORS.success,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  hintText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.bodySmall,
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
});
