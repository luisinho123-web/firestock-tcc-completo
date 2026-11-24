import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { useRouter } from 'expo-router';

import { AuthDivider } from '@/components/auth/auth-divider';
import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { AuthScreen } from '@/components/auth/auth-screen';
import { AuthTextField } from '@/components/auth/auth-text-field';
import { GoogleButton } from '@/components/auth/google-button';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';
import { Checkbox } from '@/components/ui/checkbox';
import { IconButton } from '@/components/ui/icon-button';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '@/components/ui/theme';
import { useProfile } from '@/contexts/profile-context';
import { ApiError, errorMessage, registerUser } from '@/services/auth';
import { INPUT_LIMITS, sanitizeEmail, sanitizeName, sanitizePassword } from '@/utils/sanitize';
import { isValidEmail, isValidName, MIN_PASSWORD_LENGTH } from '@/utils/validation';

function getPasswordStrength(value: string) {
  if (value.length >= 12 && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) {
    return { label: 'Excelente', score: 4, color: COLORS.success };
  }
  if (value.length >= 10 && /[A-Z]/.test(value) && /[0-9]/.test(value)) {
    return { label: 'Senha forte', score: 3, color: COLORS.success };
  }
  if (value.length >= 8) {
    return { label: 'Média', score: 2, color: COLORS.warning };
  }
  return { label: 'Fraca', score: 1, color: COLORS.error };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { setName: setProfileName, setEmail: setProfileEmail, setToken, setIsAuthenticated } = useProfile();
  const google = useGoogleSignIn();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [termsError, setTermsError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  const handleRegister = async () => {
    if (isSubmitting) return;

    const nextNameError = !name.trim()
      ? 'Informe seu nome completo.'
      : !isValidName(name)
        ? 'Use apenas letras no nome (mínimo 2).'
        : '';
    const nextEmailError = !email.trim() ? 'Informe seu e-mail.' : !isValidEmail(email) ? 'Digite um e-mail válido.' : '';
    const nextPasswordError =
      password.length < MIN_PASSWORD_LENGTH ? `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` : '';
    const nextConfirmPasswordError = !confirmPassword
      ? 'Confirme a sua senha.'
      : confirmPassword !== password
        ? 'As senhas não são iguais.'
        : '';
    const nextTermsError = acceptedTerms ? '' : 'Você precisa aceitar os termos para continuar.';

    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);
    setTermsError(nextTermsError);
    if (nextNameError || nextEmailError || nextPasswordError || nextConfirmPasswordError || nextTermsError) return;

    try {
      setIsSubmitting(true);
      const response = await registerUser({ name: name.trim(), email: email.trim(), password });
      setProfileName(response.user.name);
      setProfileEmail(response.user.email);
      setToken(response.token);
      // userId/avatarUrl come from the SIGNED_IN handler in profile-context.tsx (this signUp call is what
      // triggers it), so both stay in sync in one place regardless of how the app signed in.
      setIsAuthenticated(true);
      router.replace('/home');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setEmailError('Este e-mail já tem uma conta. Tente entrar.');
      } else if (error instanceof ApiError && error.status === 403) {
        // The account was created but needs e-mail confirmation: this is not a failure, so don't show it as
        // one, and don't leave the person on this screen where tapping "Criar conta" again just re-sends the
        // confirmation e-mail and hits Supabase's resend cooldown.
        Alert.alert('Confirme seu e-mail', errorMessage(error), [
          { text: 'Ir para o login', onPress: () => (router.canGoBack() ? router.back() : router.replace('/login')) },
        ]);
      } else {
        Alert.alert('Não foi possível criar a conta', errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen>
      <IconButton
        icon="chevron.left"
        accessibilityLabel="Voltar"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))}
        style={styles.backButton}
      />

      <AuthHeader title="Criar conta" subtitle="Leva menos de 1 minuto. Bora economizar nas compras?" />

      <AuthTextField
        label="Nome completo"
        icon="person.fill"
        placeholder="Seu nome completo"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={INPUT_LIMITS.name}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        value={name}
        onChangeText={(value) => {
          setName(sanitizeName(value));
          if (nameError) setNameError('');
        }}
        error={nameError}
      />

      <AuthTextField
        ref={emailRef}
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

      <View style={styles.passwordWrapper}>
        <AuthTextField
          ref={passwordRef}
          label="Senha"
          icon="lock.fill"
          placeholder="Crie uma senha"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={INPUT_LIMITS.password}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          value={password}
          onChangeText={(value) => {
            setPassword(sanitizePassword(value));
            if (passwordError) setPasswordError('');
            // Se a confirmação já foi digitada, uma diferença nova some assim que as duas voltam a coincidir.
            if (confirmPasswordError) setConfirmPasswordError('');
          }}
          error={passwordError}
          hint={password.length === 0 ? `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.` : undefined}
        />
        {password.length > 0 ? (
          <View style={styles.passwordStrengthRow} accessible accessibilityLabel={`Força da senha: ${passwordStrength.label}`}>
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                style={[
                  styles.passwordStrengthBar,
                  { backgroundColor: index < passwordStrength.score ? passwordStrength.color : COLORS.border },
                ]}
              />
            ))}
            <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>{passwordStrength.label}</Text>
          </View>
        ) : null}
      </View>

      <AuthTextField
        ref={confirmPasswordRef}
        label="Confirmar senha"
        icon="lock.fill"
        placeholder="Digite a senha novamente"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={INPUT_LIMITS.password}
        returnKeyType="done"
        onSubmitEditing={handleRegister}
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(sanitizePassword(value));
          if (confirmPasswordError) setConfirmPasswordError('');
        }}
        error={confirmPasswordError}
      />

      <Checkbox
        checked={acceptedTerms}
        onChange={(checked) => {
          setAcceptedTerms(checked);
          if (checked) setTermsError('');
        }}
        hasError={Boolean(termsError)}
        accessibilityLabel="Li e aceito os Termos de uso e a Política de privacidade"
        style={styles.termsRow}>
        <Text style={styles.termsText}>Li e aceito os Termos de uso e a Política de privacidade</Text>
      </Checkbox>
      {termsError ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {termsError}
        </Text>
      ) : null}

      <AuthPrimaryButton label="Criar conta" onPress={handleRegister} loading={isSubmitting} />
      <AuthDivider label="ou continue com" />
      <GoogleButton onPress={google.signIn} loading={google.isLoading} />
      <AuthFooterLink
        prompt="Já tem uma conta?"
        actionLabel="Entrar"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginBottom: SPACING.xl,
  },
  passwordWrapper: {
    width: '100%',
  },
  passwordStrengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    width: '100%',
    marginTop: -SPACING.xs,
    marginBottom: SPACING.md,
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.semibold,
    marginLeft: 4,
  },
  termsRow: {
    gap: SPACING.sm,
    width: '100%',
    marginBottom: SPACING.lg,
  },
  termsText: {
    flex: 1,
    fontSize: FONT_SIZES.label,
    lineHeight: 19,
    color: COLORS.textTertiary,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.label,
    lineHeight: 18,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
    width: '100%',
  },
});
