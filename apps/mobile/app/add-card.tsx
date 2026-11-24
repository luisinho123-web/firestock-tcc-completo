import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { toast } from '@/components/ui/toast';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

import { AuthTextField } from '@/components/auth/auth-text-field';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { usePaymentMethods, type CardBrand, type CardKind } from '@/contexts/payment-methods-context';
import { maskCardNumber, maskExpiry } from '@/utils/masks';
import { sanitizeCardHolder, sanitizeDigits } from '@/utils/sanitize';
import { isValidCardExpiry, isValidCardNumber, isValidName } from '@/utils/validation';

function detectBrand(digits: string): CardBrand {
  return /^(5[1-5]|2[2-7])/.test(digits) ? 'mastercard' : 'visa';
}

type FieldErrors = Partial<Record<'number' | 'holder' | 'expiry' | 'cvv', string>>;

export default function AddCardScreen() {
  const router = useRouter();
  const { addCard } = usePaymentMethods();
  const holderRef = useRef<TextInput>(null);
  const expiryRef = useRef<TextInput>(null);
  const cvvRef = useRef<TextInput>(null);
  const [kind, setKind] = useState<CardKind>('credito');
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const leavingRef = useRef(false);
  useDiscardGuard(Boolean(cardNumber || holderName || expiry || cvv), leavingRef);

  const digits = cardNumber.replace(/\D/g, '');
  const brand = detectBrand(digits);

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    const nextErrors: FieldErrors = {};
    if (digits.length < 16) nextErrors.number = 'Informe os 16 dígitos do cartão.';
    else if (!isValidCardNumber(digits)) nextErrors.number = 'Número de cartão inválido. Confira os dígitos.';
    if (!holderName.trim()) nextErrors.holder = 'Informe o nome impresso no cartão.';
    else if (!isValidName(holderName)) nextErrors.holder = 'Use apenas letras no nome do cartão.';
    if (!/^\d{2}\/\d{2}$/.test(expiry)) nextErrors.expiry = 'Use o formato MM/AA.';
    else if (!isValidCardExpiry(expiry)) nextErrors.expiry = 'Cartão vencido ou mês inválido.';
    if (cvv.length < 3) nextErrors.cvv = 'CVV incompleto.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    // Only the last four digits are kept — the full number and CVV never leave this screen.
    await addCard({ brand, kind, holderName: holderName.trim().toUpperCase(), last4: digits.slice(-4), expiry });
    setIsSaving(false);
    toast.success('Cartão adicionado.');
    leavingRef.current = true;
    router.back();
  };

  return (
    <FormScreen
      header={<ScreenHeader title="Adicionar cartão" style={styles.header} />}
      footer={<Button label="Salvar cartão" onPress={handleSave} disabled={isSaving} loading={isSaving} />}>
      <View
        style={styles.cardPreview}
        accessible
        accessibilityLabel={`Prévia do cartão ${brand === 'visa' ? 'Visa' : 'Mastercard'}${
          digits.length >= 4 ? ` final ${digits.slice(-4)}` : ''
        }`}>
        <View style={styles.cardPreviewTopRow}>
          <View style={styles.chip} />
          <BrandMark brand={brand} />
        </View>
        <Text style={styles.cardPreviewNumber}>{cardNumber || '•••• •••• •••• ••••'}</Text>
        <View style={styles.cardPreviewBottomRow}>
          <Text style={styles.cardPreviewName} numberOfLines={1}>
            {holderName.trim() ? holderName.toUpperCase() : 'SEU NOME'}
          </Text>
          <Text style={styles.cardPreviewExpiry}>{expiry || 'MM/AA'}</Text>
        </View>
      </View>

      <View style={styles.segment}>
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { key: 'credito', label: 'Crédito' },
            { key: 'debito', label: 'Débito' },
          ]}
        />
      </View>

      <AuthTextField
        label="Número do cartão"
        icon="creditcard.fill"
        keyboardType="number-pad"
        autoComplete="cc-number"
        textContentType="creditCardNumber"
        maxLength={19}
        value={cardNumber}
        onChangeText={(value) => {
          setCardNumber(maskCardNumber(value));
          clearError('number');
        }}
        placeholder="0000 0000 0000 0000"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => holderRef.current?.focus()}
        error={errors.number}
      />

      <AuthTextField
        ref={holderRef}
        label="Nome impresso no cartão"
        value={holderName}
        onChangeText={(value) => {
          setHolderName(sanitizeCardHolder(value));
          clearError('holder');
        }}
        placeholder="Como está no cartão"
        autoCapitalize="characters"
        autoComplete="cc-name"
        textContentType="name"
        maxLength={26}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => expiryRef.current?.focus()}
        error={errors.holder}
      />

      <View style={styles.row}>
        <View style={styles.rowField}>
          <AuthTextField
            ref={expiryRef}
            label="Validade"
            keyboardType="number-pad"
            autoComplete="cc-exp"
            maxLength={5}
            value={expiry}
            onChangeText={(value) => {
              setExpiry(maskExpiry(value));
              clearError('expiry');
            }}
            placeholder="MM/AA"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => cvvRef.current?.focus()}
            error={errors.expiry}
          />
        </View>
        <View style={styles.rowField}>
          <AuthTextField
            ref={cvvRef}
            label="CVV"
            icon="lock.fill"
            keyboardType="number-pad"
            autoComplete="cc-csc"
            maxLength={4}
            secureTextEntry
            value={cvv}
            onChangeText={(value) => {
              setCvv(sanitizeDigits(value, 4));
              clearError('cvv');
            }}
            placeholder="000"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            error={errors.cvv}
          />
        </View>
      </View>

      <View style={styles.secureRow}>
        <IconSymbol name="shield.fill" size={14} color={COLORS.success} />
        <Text style={styles.secureText}>Guardamos só os 4 últimos dígitos. O número completo e o CVV não são salvos.</Text>
      </View>
    </FormScreen>
  );
}

function BrandMark({ brand }: { brand: CardBrand }) {
  if (brand === 'mastercard') {
    return (
      <View style={styles.mastercardMark}>
        <View style={[styles.mastercardCircle, { backgroundColor: '#EB001B' }]} />
        <View style={[styles.mastercardCircle, styles.mastercardCircleRight, { backgroundColor: '#F79E1B' }]} />
      </View>
    );
  }
  return <Text style={styles.visaMark}>VISA</Text>;
}

const styles = StyleSheet.create({
  header: {
    marginBottom: SPACING.lg,
  },
  segment: {
    marginBottom: SPACING.md,
  },
  cardPreview: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.large,
    padding: 20,
    gap: 22,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardPreviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  mastercardMark: {
    flexDirection: 'row',
    width: 44,
  },
  mastercardCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    opacity: 0.9,
  },
  mastercardCircleRight: {
    marginLeft: -10,
  },
  visaMark: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.heavy,
    fontStyle: 'italic',
  },
  cardPreviewNumber: {
    color: COLORS.onDark,
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 2,
  },
  cardPreviewBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPreviewName: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  cardPreviewExpiry: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rowField: {
    flex: 1,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
    marginBottom: SPACING.lg,
  },
  secureText: {
    flex: 1,
    lineHeight: 17,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
});
