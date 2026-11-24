import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { AuthTextField } from '@/components/auth/auth-text-field';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { errorMessage, signOutUser, startRecoverySession, updatePassword } from '@/services/auth';
import { INPUT_LIMITS, sanitizePassword } from '@/utils/sanitize';

const STRENGTH_META = [
  { label: '', color: COLORS.border },
  { label: 'Senha fraca', color: COLORS.error },
  { label: 'Senha boa', color: COLORS.warning },
  { label: 'Senha forte', color: COLORS.success },
];

/** Tokens Supabase puts in the fragment of the recovery link (e.g. `#access_token=…&refresh_token=…&type=recovery`). */
function readRecoveryLink(url: string | null) {
  const fragment = url?.split('#')[1];
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { accessToken, refreshToken, error: null };
  const error = params.get('error_description') ?? params.get('error');
  return error ? { accessToken: null, refreshToken: null, error } : null;
}

export default function NewPasswordScreen() {
  const router = useRouter();
  const confirmRef = useRef<TextInput>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recoveryLink = readRecoveryLink(Linking.useLinkingURL());

  const hasMinLength = password.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const score = [hasMinLength, hasLetterAndNumber, passwordsMatch].filter(Boolean).length;
  const strength = STRENGTH_META[score];

  const canSubmit = hasMinLength && hasLetterAndNumber && passwordsMatch;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    if (recoveryLink?.error) {
      Alert.alert('Link inválido', 'Este link de recuperação expirou ou já foi usado. Peça um novo em "Esqueci minha senha".');
      return;
    }

    try {
      setIsSubmitting(true);
      const isRecovery = Boolean(recoveryLink?.accessToken && recoveryLink.refreshToken);
      if (recoveryLink?.accessToken && recoveryLink.refreshToken) {
        await startRecoverySession({ accessToken: recoveryLink.accessToken, refreshToken: recoveryLink.refreshToken });
      }
      await updatePassword(password);
      if (isRecovery) {
        // The recovery link only proves who the person is; they sign in with the new password like anyone else.
        await signOutUser().catch(() => undefined);
        Alert.alert('Senha alterada', 'Entre com a sua nova senha.', [{ text: 'OK', onPress: () => router.replace('/login') }]);
        return;
      }
      Alert.alert('Senha alterada', 'Sua senha foi atualizada com sucesso.', [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/home')) },
      ]);
    } catch (error) {
      Alert.alert('Não foi possível alterar a senha', errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormScreen
      header={<ScreenHeader style={styles.topBar} />}
      footer={<Button label="Salvar nova senha" onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <IconSymbol name="shield.fill" size={20} color={COLORS.navy} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Crie uma nova senha
          </Text>
          <Text style={styles.headerSubtitle}>Ela vai substituir a senha antiga em todos os seus acessos.</Text>
        </View>
      </View>

      <AuthTextField
        label="Nova senha"
        icon="lock.fill"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
        value={password}
        maxLength={INPUT_LIMITS.password}
        onChangeText={(value) => setPassword(sanitizePassword(value))}
        placeholder="Digite a nova senha"
      />

      {password.length > 0 ? (
        <View style={styles.strengthRow} accessible accessibilityLabel={strength.label || 'Senha muito fraca'}>
          <View style={styles.strengthTrack}>
            {[0, 1, 2, 3].map((segment) => (
              <View key={segment} style={[styles.strengthSegment, segment < score && { backgroundColor: strength.color }]} />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
        </View>
      ) : null}

      <AuthTextField
        ref={confirmRef}
        label="Confirmar nova senha"
        icon="lock.fill"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        value={confirmPassword}
        maxLength={INPUT_LIMITS.password}
        onChangeText={(value) => setConfirmPassword(sanitizePassword(value))}
        placeholder="Digite a senha novamente"
        error={confirmPassword.length > 0 && !passwordsMatch ? 'As senhas não são iguais.' : undefined}
      />

      <View style={styles.checklist} accessibilityRole="list">
        <ChecklistItem checked={hasMinLength} label="Pelo menos 8 caracteres" />
        <ChecklistItem checked={hasLetterAndNumber} label="Letras e números" />
        <ChecklistItem checked={passwordsMatch} label="As duas senhas são iguais" />
      </View>
    </FormScreen>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={styles.checklistRow} accessible accessibilityLabel={`${label}: ${checked ? 'atendido' : 'pendente'}`}>
      <View style={[styles.checklistDot, checked && styles.checklistDotActive]}>
        {checked ? <IconSymbol name="checkmark" size={12} color={COLORS.onDark} /> : null}
      </View>
      <Text style={styles.checklistLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    marginBottom: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.input,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.title,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  headerSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
    lineHeight: 18,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -SPACING.xs,
    marginBottom: SPACING.md,
  },
  strengthTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  strengthLabel: {
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  checklist: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    padding: 14,
    gap: 10,
    marginTop: SPACING.xs,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checklistDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistDotActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  checklistLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
