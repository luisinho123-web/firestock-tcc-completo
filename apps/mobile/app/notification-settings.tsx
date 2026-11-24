import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthTextField } from '@/components/auth/auth-text-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenHeader } from '@/components/ui/screen-header';
import { toast } from '@/components/ui/toast';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { useNotificationPrefs } from '@/contexts/notification-prefs-context';
import { useProfile } from '@/contexts/profile-context';
import { openNotificationSettings } from '@/services/push';
import type { NotificationChannel } from '@/services/notification-prefs';
import { maskPhone } from '@/utils/masks';
import { toWhatsAppNumber } from '@/utils/whatsapp-phone';

const OPTIONS: { channel: NotificationChannel; icon: IconSymbolName; title: string; subtitle: string }[] = [
  { channel: 'push', icon: 'bell.fill', title: 'Notificação no celular', subtitle: 'Um aviso na tela do aparelho, como nos outros aplicativos de pedido.' },
  { channel: 'whatsapp', icon: 'phone.fill', title: 'WhatsApp', subtitle: 'Uma mensagem no seu WhatsApp a cada mudança do pedido.' },
  { channel: 'none', icon: 'xmark', title: 'Não receber avisos', subtitle: 'Você ainda acompanha tudo na tela de pedidos.' },
];

const digitsOf = (value: string) => value.replace(/\D/g, '');

export default function NotificationSettingsScreen() {
  const { phone: profilePhone } = useProfile();
  const { channel, phoneDigits, loading, permission, pushProblem, save, refresh } = useNotificationPrefs();
  const [draftChannel, setDraftChannel] = useState<NotificationChannel>(channel);
  const [draftPhone, setDraftPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [saving, setSaving] = useState(false);

  // Mostra o que está salvo; sem número de WhatsApp salvo, sugere o celular do cadastro.
  useEffect(() => {
    if (loading) return;
    setDraftChannel(channel);
    setDraftPhone(maskPhone(phoneDigits || digitsOf(profilePhone)));
  }, [loading, channel, phoneDigits, profilePhone]);

  // Ao abrir a tela, confere a permissão do aparelho (pode ter mudado nos ajustes).
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = draftChannel !== channel || (draftChannel === 'whatsapp' && digitsOf(draftPhone) !== phoneDigits);

  const handleSave = async () => {
    if (saving) return;
    if (draftChannel === 'whatsapp' && !toWhatsAppNumber(draftPhone)) {
      setPhoneError('Informe um celular válido com DDD.');
      return;
    }
    setPhoneError('');
    setSaving(true);
    try {
      const { warning } = await save(draftChannel, draftPhone);
      toast.success('Preferências salvas.');
      if (warning) Alert.alert('Notificações no celular', warning);
    } catch (error) {
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const pushActive = channel === 'push' && permission === 'granted' && !pushProblem;

  return (
    <FormScreen
      header={<ScreenHeader title="Preferências de notificação" style={styles.header} />}
      footer={<Button label="Salvar" onPress={handleSave} disabled={!isDirty || saving || loading} loading={saving} />}>
      <Text style={styles.intro}>
        Avisamos quando a loja começa a separar, deixa pronto, sai para entregar, conclui ou cancela o seu pedido. Escolha como quer receber.
      </Text>

      <View style={styles.options} accessibilityRole="radiogroup">
        {OPTIONS.map((option) => {
          const selected = draftChannel === option.channel;
          return (
            <PressableScale
              key={option.channel}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => {
                setDraftChannel(option.channel);
                setPhoneError('');
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.title}. ${option.subtitle}`}>
              <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                <IconSymbol name={option.icon} size={18} color={selected ? COLORS.onDark : COLORS.navy} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
            </PressableScale>
          );
        })}
      </View>

      {draftChannel === 'whatsapp' ? (
        <AuthTextField
          label="Número do WhatsApp"
          icon="phone.fill"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={15}
          value={draftPhone}
          onChangeText={(value) => {
            setDraftPhone(maskPhone(value));
            setPhoneError('');
          }}
          placeholder="(00) 00000-0000"
          error={phoneError}
          hint="Com DDD. Ao salvar, você aceita receber mensagens do FireStock sobre os seus pedidos neste número."
        />
      ) : null}

      {draftChannel === 'push' ? (
        <View style={[styles.status, pushActive ? styles.statusOk : styles.statusWarn]} accessibilityLiveRegion="polite">
          <IconSymbol
            name={pushActive ? 'checkmark.circle.fill' : 'bell.fill'}
            size={18}
            color={pushActive ? COLORS.success : COLORS.warning}
          />
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>
              {pushActive ? 'Notificações ativas neste aparelho' : channel === 'push' ? 'Notificações ainda não ativas' : 'Será ativado ao salvar'}
            </Text>
            {pushProblem && channel === 'push' ? <Text style={styles.statusBody}>{pushProblem}</Text> : null}
            {permission === 'denied' ? (
              <PressableScale onPress={() => openNotificationSettings()} accessibilityRole="button" accessibilityLabel="Abrir ajustes do aparelho">
                <Text style={styles.statusLink}>Abrir ajustes do aparelho</Text>
              </PressableScale>
            ) : null}
          </View>
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: SPACING.md },
  intro: { color: COLORS.textTertiary, fontSize: FONT_SIZES.body, marginBottom: SPACING.lg },
  options: { gap: SPACING.sm, marginBottom: SPACING.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
  },
  optionSelected: { borderColor: COLORS.navy, backgroundColor: COLORS.primarySoft },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  optionIconSelected: { backgroundColor: COLORS.navy },
  optionText: { flex: 1 },
  optionTitle: { color: COLORS.navy, fontSize: FONT_SIZES.body, fontWeight: FONT_WEIGHTS.semibold },
  optionSubtitle: { color: COLORS.textTertiary, fontSize: FONT_SIZES.small, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: COLORS.navy },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.navy },
  status: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.medium, marginBottom: SPACING.lg },
  statusOk: { backgroundColor: COLORS.successSoft },
  statusWarn: { backgroundColor: COLORS.warningSoft },
  statusText: { flex: 1, gap: 4 },
  statusTitle: { color: COLORS.navy, fontSize: FONT_SIZES.small, fontWeight: FONT_WEIGHTS.semibold },
  statusBody: { color: COLORS.textTertiary, fontSize: FONT_SIZES.small },
  statusLink: { color: COLORS.orange, fontSize: FONT_SIZES.small, fontWeight: FONT_WEIGHTS.semibold },
});
