import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useNavigation, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { AuthTextField } from '@/components/auth/auth-text-field';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { useCart } from '@/contexts/cart-context';
import { useProfile } from '@/contexts/profile-context';
import { errorMessage, signOutUser } from '@/services/auth';
import { profileService, supabase } from '@/services/supabase';
import { initials } from '@/utils/format';
import { useIsCompact } from '@/hooks/use-is-compact';
import { maskCpf, maskDate, maskPhone } from '@/utils/masks';
import { INPUT_LIMITS, sanitizeName } from '@/utils/sanitize';
import { isValidBirthDate, isValidCpf, isValidName, isValidPhone } from '@/utils/validation';

function memberSinceLabel(timestamp: number): string {
  const date = new Date(timestamp);
  return `Cliente desde ${date.toLocaleDateString('pt-BR', { month: 'long' })} de ${date.getFullYear()}`;
}

type FieldErrors = Partial<Record<'name' | 'phone' | 'cpf' | 'birthDate', string>>;

/** Optional fields are only validated once filled in. */
function validate(draft: { name: string; phone: string; cpf: string; birthDate: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.name.trim()) errors.name = 'Informe seu nome.';
  else if (!isValidName(draft.name)) errors.name = 'Use apenas letras no nome (mínimo 2).';
  if (draft.phone && !isValidPhone(draft.phone)) errors.phone = 'Celular incompleto.';
  if (draft.cpf && !isValidCpf(draft.cpf)) errors.cpf = 'CPF inválido.';
  if (draft.birthDate && !isValidBirthDate(draft.birthDate)) errors.birthDate = 'Data inválida.';
  return errors;
}

export default function AccountScreen() {
  const router = useRouter();
  const compact = useIsCompact();
  const navigation = useNavigation();
  const {
    name,
    email,
    phone,
    cpf,
    birthDate,
    memberSince,
    userId,
    avatarUrl,
    setName,
    setEmail,
    setPhone,
    setCpf,
    setBirthDate,
    setIsAuthenticated,
    setToken,
    setAvatarUrl,
  } = useProfile();
  const { clearCart } = useCart();
  const phoneRef = useRef<TextInput>(null);
  const cpfRef = useRef<TextInput>(null);
  const birthDateRef = useRef<TextInput>(null);
  const [draftName, setDraftName] = useState(name);
  const [draftPhone, setDraftPhone] = useState(phone);
  const [draftCpf, setDraftCpf] = useState(cpf);
  const [draftBirthDate, setDraftBirthDate] = useState(birthDate);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const leavingRef = useRef(false);

  const pickAndUploadAvatar = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso para escolher a foto de perfil.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;

    const asset = result.assets[0];
    const contentType =
      asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';

    // Optimistic: show the new photo right away, revert only if the upload actually fails.
    setPreviewUri(asset.uri);
    setIsUploadingAvatar(true);
    try {
      const url = await profileService.updateAvatar(userId, { uri: asset.uri, contentType });
      setAvatarUrl(url);
      setPreviewUri(null);
      toast.success('Foto de perfil atualizada.');
    } catch (error) {
      setPreviewUri(null);
      Alert.alert('Não foi possível atualizar a foto', errorMessage(error));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangeAvatar = () => {
    Alert.alert('Foto de perfil', undefined, [
      { text: 'Câmera', onPress: () => pickAndUploadAvatar('camera') },
      { text: 'Galeria', onPress: () => pickAndUploadAvatar('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const isDirty = draftName.trim() !== name || draftPhone !== phone || draftCpf !== cpf || draftBirthDate !== birthDate;

  // Sair com alterações não salvas pergunta antes (voltar, gesto, voltar do navegador e fechar a aba).
  useDiscardGuard(isDirty, leavingRef);

  const handleSave = async () => {
    if (isSaving) return;
    const nextErrors = validate({ name: draftName, phone: draftPhone, cpf: draftCpf, birthDate: draftBirthDate });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      await profileService.updateProfileFields(userId, {
        fullName: draftName.trim(),
        phone: draftPhone,
        cpf: draftCpf,
        birthDate: draftBirthDate,
      });
      setName(draftName.trim());
      setPhone(draftPhone);
      setCpf(draftCpf);
      setBirthDate(draftBirthDate);
      leavingRef.current = true;
      toast.success('Dados atualizados com sucesso.');
      router.back();
    } catch (error) {
      Alert.alert('Não foi possível salvar', errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleDeleteAccount = () => {
    if (isDeletingAccount) return;
    Alert.alert('Excluir conta', 'Essa ação é permanente e todos os seus dados serão apagados. Deseja continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setIsDeletingAccount(true);
          try {
            // Runs entirely on the server (the only place allowed to hold the service_role key): removes
            // the avatar file, then the auth.users row, which cascades to profiles, addresses, favorites,
            // notifications, payment_methods and order_reviews.
            const { error } = await supabase.functions.invoke('delete-account');
            if (error) throw error;

            leavingRef.current = true;
            // The account is gone server-side; this just clears the session cached on the device.
            await signOutUser().catch(() => undefined);
            clearCart();
            setName('');
            setEmail('');
            setPhone('');
            setCpf('');
            setBirthDate('');
            setToken('');
            setIsAuthenticated(false);
            router.dismissTo('/onboarding');
          } catch (error) {
            // The account was NOT deleted — never sign the person out or clear local state on a failure.
            Alert.alert('Não foi possível excluir sua conta', errorMessage(error));
          } finally {
            setIsDeletingAccount(false);
          }
        },
      },
    ]);
  };

  return (
    <FormScreen
      header={<ScreenHeader title="Dados da conta" style={styles.header} />}
      footer={
        <>
          <Button label="Salvar alterações" onPress={handleSave} disabled={!isDirty || isSaving} loading={isSaving} />
          <Button
            label="Excluir minha conta"
            variant="danger"
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            loading={isDeletingAccount}
          />
        </>
      }>
      <View style={styles.avatarSection}>
        <PressableScale
          onPress={handleChangeAvatar}
          disabled={isUploadingAvatar}
          accessibilityRole="button"
          accessibilityLabel="Trocar foto de perfil">
          <View style={styles.avatar}>
            {previewUri || avatarUrl ? (
              <Image
                source={{ uri: previewUri ?? avatarUrl ?? undefined }}
                style={styles.avatarImage}
                contentFit="cover"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            ) : (
              <Text style={styles.avatarText} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {initials(draftName) || '?'}
              </Text>
            )}
            {isUploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={COLORS.onDark} />
              </View>
            ) : null}
          </View>
          <View style={styles.avatarEditBadge}>
            <IconSymbol name="camera.fill" size={14} color={COLORS.onDark} />
          </View>
        </PressableScale>
        <Text style={styles.avatarName}>{draftName.trim() || 'Usuário'}</Text>
        <Text style={styles.avatarSubtitle}>{memberSinceLabel(memberSince)}</Text>
      </View>

      <AuthTextField
        label="Nome completo"
        icon="person.fill"
        value={draftName}
        onChangeText={(value) => {
          setDraftName(sanitizeName(value));
          clearError('name');
        }}
        placeholder="Seu nome completo"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={INPUT_LIMITS.name}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneRef.current?.focus()}
        error={errors.name}
      />

      <AuthTextField
        label="E-mail"
        icon="envelope.fill"
        value={email.trim() || 'Sem e-mail cadastrado'}
        editable={false}
        hint="O e-mail é usado para entrar e não pode ser alterado aqui."
      />

      <AuthTextField
        ref={phoneRef}
        label="Celular"
        icon="phone.fill"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={15}
        value={draftPhone}
        onChangeText={(value) => {
          setDraftPhone(maskPhone(value));
          clearError('phone');
        }}
        placeholder="(00) 00000-0000"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => cpfRef.current?.focus()}
        error={errors.phone}
      />

      <View style={[styles.row, compact && styles.rowStacked]}>
        <View style={compact ? undefined : styles.rowField}>
          <AuthTextField
            ref={cpfRef}
            label="CPF"
            keyboardType="number-pad"
            maxLength={14}
            value={draftCpf}
            onChangeText={(value) => {
              setDraftCpf(maskCpf(value));
              clearError('cpf');
            }}
            placeholder="000.000.000-00"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => birthDateRef.current?.focus()}
            error={errors.cpf}
          />
        </View>
        <View style={compact ? undefined : styles.rowField}>
          <AuthTextField
            ref={birthDateRef}
            label="Nascimento"
            keyboardType="number-pad"
            autoComplete="birthdate-full"
            maxLength={10}
            value={draftBirthDate}
            onChangeText={(value) => {
              setDraftBirthDate(maskDate(value));
              clearError('birthDate');
            }}
            placeholder="DD/MM/AAAA"
            returnKeyType="done"
            error={errors.birthDate}
          />
        </View>
      </View>

      <PressableScale style={styles.securityRow} onPress={() => router.push('/new-password')} accessibilityRole="button">
        <View style={styles.securityIcon}>
          <IconSymbol name="lock.fill" size={18} color={COLORS.navy} />
        </View>
        <View style={styles.securityInfo}>
          <Text style={styles.securityTitle}>Alterar senha</Text>
          <Text style={styles.securitySubtitle}>Mantenha sua conta protegida</Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={COLORS.textFaint} />
      </PressableScale>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: SPACING.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.display,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  avatarName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.h2,
    fontWeight: FONT_WEIGHTS.heavy,
    marginTop: SPACING.sm,
  },
  avatarSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rowStacked: {
    flexDirection: 'column',
    gap: 0,
  },
  rowField: {
    flex: 1,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    padding: 14,
    marginTop: SPACING.xs,
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityInfo: {
    flex: 1,
    gap: 2,
  },
  securityTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  securitySubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
});
