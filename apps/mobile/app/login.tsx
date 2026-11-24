import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { useRouter } from 'expo-router';

import { AuthDivider } from '@/components/auth/auth-divider';
import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthLogo } from '@/components/auth/auth-logo';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { AuthScreen } from '@/components/auth/auth-screen';
import { AuthTextField } from '@/components/auth/auth-text-field';
import { GoogleButton } from '@/components/auth/google-button';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '@/components/ui/theme';
import { useProfile } from '@/contexts/profile-context';
import { ApiError, errorMessage, loginUser } from '@/services/auth';
import { INPUT_LIMITS, sanitizeEmail, sanitizePassword } from '@/utils/sanitize';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '@/utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const { setEmail: setProfileEmail, setName: setProfileName, setToken, setIsAuthenticated } = useProfile();
  const google = useGoogleSignIn();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (isSubmitting) return;

    const nextEmailError = !email.trim() ? 'Informe seu e-mail.' : !isValidEmail(email) ? 'Digite um e-mail válido.' : '';
    const nextPasswordError = !password
      ? 'Informe sua senha.'
      : password.length < MIN_PASSWORD_LENGTH
      ? `A senha tem pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
      : '';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) return;

    try {
      setIsSubmitting(true);
      const response = await loginUser({ email: email.trim(), password });
      setProfileEmail(response.user.email);
      setProfileName(response.user.name);
      setToken(response.token);
      // userId/avatarUrl come from the SIGNED_IN handler in profile-context.tsx (this signInWithPassword
      // call is what triggers it), so both stay in sync in one place regardless of how the app signed in.
      setIsAuthenticated(true);
      router.replace('/home');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // The API deliberately doesn't say which field is wrong (no account enumeration), so neither do we.
        setPasswordError('E-mail ou senha incorretos.');
      } else {
        Alert.alert('Não foi possível entrar', errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen>
      <AuthLogo />
      <AuthHeader title="Que bom te ver de novo!" subtitle="Entre para continuar suas compras nos mercados parceiros." />

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
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        value={email}
        onChangeText={(value) => {
          setEmail(sanitizeEmail(value));
          if (emailError) setEmailError('');
        }}
        error={emailError}
      />

      <AuthTextField
        ref={passwordRef}
        label="Senha"
        icon="lock.fill"
        placeholder="Digite sua senha"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        maxLength={INPUT_LIMITS.password}
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        value={password}
        onChangeText={(value) => {
          setPassword(sanitizePassword(value));
          if (passwordError) setPasswordError('');
        }}
        error={passwordError}
      />

      <View style={styles.optionsRow}>
        <Pressable onPress={() => router.push('/forgot-password')} hitSlop={12} accessibilityRole="link">
          <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
        </Pressable>
      </View>

      <AuthPrimaryButton label="Entrar" onPress={handleLogin} loading={isSubmitting} />
      <AuthDivider label="ou entre com" />
      <GoogleButton onPress={google.signIn} loading={google.isLoading} />
      <AuthFooterLink prompt="Ainda não tem conta?" actionLabel="Cadastre-se" onPress={() => router.push('/register')} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: -SPACING.xxs,
    marginBottom: SPACING.xl,
  },
  forgotPasswordText: {
    color: COLORS.navy,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.bodySmall,
  },
});
