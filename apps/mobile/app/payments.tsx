import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { usePaymentMethods, type PaymentMethod } from '@/contexts/payment-methods-context';

const METHOD_ICON: Record<'pix' | 'dinheiro', number> = {
  pix: require('@/assets/icons/payment/pix.png'),
  dinheiro: require('@/assets/icons/payment/dinheiro.png'),
};

function methodLabel(method: PaymentMethod): { title: string; subtitle: string } {
  if (method.type === 'pix') return { title: 'Pix', subtitle: 'Aprovação na hora' };
  if (method.type === 'dinheiro') return { title: 'Dinheiro na entrega', subtitle: 'Informe se precisa de troco' };
  const brandLabel = method.brand === 'visa' ? 'Visa' : 'Mastercard';
  return {
    title: `${brandLabel} •••• ${method.last4}`,
    subtitle: `${method.kind === 'credito' ? 'Crédito' : 'Débito'} · vence ${method.expiry}`,
  };
}

export default function PaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { methods, selectedMethod, selectedMethodId, selectMethod, removeMethod } = usePaymentMethods();

  // Preview the card the shopper will pay with; fall back to the first saved card.
  const featuredCard =
    selectedMethod?.type === 'cartao'
      ? selectedMethod
      : methods.find((method): method is Extract<PaymentMethod, { type: 'cartao' }> => method.type === 'cartao');

  const handleRemove = (method: PaymentMethod) => {
    const { title } = methodLabel(method);
    Alert.alert('Remover cartão?', `${title} será removido dos seus métodos de pagamento.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
          await removeMethod(method.id);
          toast.success('Cartão removido.');
        },
      },
    ]);
  };

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + SPACING.md,
          paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.lg,
          paddingHorizontal: SPACING.lg,
        }}
        showsVerticalScrollIndicator={false}>
        <ScreenContainer fill={false}>
          <ScreenHeader title="Pagamentos" />

          {featuredCard ? (
            <View style={styles.cardPreview}>
              <View style={styles.cardPreviewTopRow}>
                <Text style={styles.cardPreviewBrand}>
                  Fire<Text style={{ color: COLORS.orange }}>Stock</Text>
                </Text>
                <View style={styles.cardPreviewKindBadge}>
                  <Text style={styles.cardPreviewKindText}>{featuredCard.kind === 'credito' ? 'Crédito' : 'Débito'}</Text>
                </View>
              </View>

              <BrandMark brand={featuredCard.brand} />

              <Text style={styles.cardPreviewNumber}>•••• •••• •••• {featuredCard.last4}</Text>

              <View style={styles.cardPreviewBottomRow}>
                <View>
                  <Text style={styles.cardPreviewLabel}>TITULAR</Text>
                  <Text style={styles.cardPreviewValue}>{featuredCard.holderName}</Text>
                </View>
                <View>
                  <Text style={styles.cardPreviewLabel}>VALIDADE</Text>
                  <Text style={styles.cardPreviewValue}>{featuredCard.expiry}</Text>
                </View>
                <Text style={styles.cardPreviewBrandName}>{featuredCard.brand === 'visa' ? 'VISA' : 'Mastercard'}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>MÉTODOS SALVOS</Text>

          <View style={styles.list}>
            {methods.map((method) => {
              const isActive = method.id === selectedMethodId;
              const { title, subtitle } = methodLabel(method);
              return (
                <PressableScale
                  key={method.id}
                  style={styles.row}
                  onPress={() => selectMethod(method.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={`${title}, ${subtitle}`}>
                  <View style={styles.rowIcon}>
                    {method.type === 'cartao' ? (
                      <IconSymbol name="creditcard.fill" size={18} color={COLORS.navy} />
                    ) : (
                      <Image source={METHOD_ICON[method.type]} style={styles.rowIconImage} contentFit="contain" />
                    )}
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{title}</Text>
                    <Text style={styles.rowSubtitle}>{subtitle}</Text>
                  </View>
                  {method.type === 'cartao' ? (
                    <PressableScale
                      onPress={() => handleRemove(method)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${title}`}
                      hitSlop={12}>
                      <IconSymbol name="trash.fill" size={16} color={COLORS.textFaint} />
                    </PressableScale>
                  ) : null}
                  <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                    {isActive ? <View style={styles.radioInner} /> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <PressableScale style={styles.addButton} onPress={() => router.push('/add-card')} accessibilityRole="button">
            <IconSymbol name="plus" size={18} color={COLORS.navy} />
            <Text style={styles.addButtonText}>Adicionar cartão</Text>
          </PressableScale>

          <View style={styles.secureRow}>
            <IconSymbol name="shield.fill" size={14} color={COLORS.success} />
            <Text style={styles.secureText}>Guardamos só os 4 últimos dígitos de cada cartão.</Text>
          </View>
        </ScreenContainer>
      </ScrollView>
    </View>
  );
}

function BrandMark({ brand }: { brand: 'visa' | 'mastercard' }) {
  if (brand === 'mastercard') {
    return (
      <View style={styles.mastercardMark}>
        <View style={[styles.mastercardCircle, { backgroundColor: '#EB001B' }]} />
        <View style={[styles.mastercardCircle, styles.mastercardCircleRight, { backgroundColor: '#F79E1B' }]} />
      </View>
    );
  }
  return <View style={styles.chip} />;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  cardPreview: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.large,
    padding: 20,
    gap: 18,
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
  cardPreviewBrand: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  cardPreviewKindBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardPreviewKindText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
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
  cardPreviewNumber: {
    color: COLORS.onDark,
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 2,
  },
  cardPreviewBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardPreviewLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semibold,
    letterSpacing: 0.4,
  },
  cardPreviewValue: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: 2,
  },
  cardPreviewBrandName: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.heavy,
    fontStyle: 'italic',
  },
  sectionLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.4,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  list: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconImage: {
    width: 22,
    height: 22,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  rowSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: COLORS.navy,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.navy,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: RADIUS.medium,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    marginTop: SPACING.md,
  },
  addButtonText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
  },
  secureText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
});
