import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING, TYPOGRAPHY } from '@/components/ui/theme';

const SUPPORT_EMAIL = 'suporte@firestock.com';
// TODO: replace with the real support WhatsApp number before release.
const SUPPORT_WHATSAPP_URL = 'https://wa.me/5500000000000';

/** openURL rejects when nothing can handle the link (e.g. no mail app on a simulator). */
async function openExternal(url: string, fallbackMessage: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Não foi possível abrir', fallbackMessage);
  }
}

const FAQ_ITEMS = [
  {
    question: 'Como funciona o prazo de entrega?',
    answer:
      'O prazo mostrado no checkout é uma estimativa do mercado parceiro. Você acompanha o status em tempo real em "Meus pedidos".',
  },
  {
    question: 'Posso cancelar um pedido?',
    answer:
      'Sim. Enquanto o pedido não for entregue, você pode cancelá-lo pela tela de acompanhamento. O valor pago é estornado.',
  },
  {
    question: 'Como funciona o pagamento via Pix?',
    answer: 'Ao escolher Pix no checkout, geramos um QR code e um código copia e cola válidos por 15 minutos.',
  },
  {
    question: 'Meu pedido veio errado, o que fazer?',
    answer: 'Fale direto com o mercado parceiro pelo pedido em "Meus pedidos" ou entre em contato com o nosso suporte abaixo.',
  },
];

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + SPACING.md, paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.lg },
      ]}
      showsVerticalScrollIndicator={false}>
      <ScreenContainer fill={false}>
        <ScreenHeader title="Ajuda e suporte" style={styles.header} />

        <Text style={styles.sectionLabel} accessibilityRole="header">
          PERGUNTAS FREQUENTES
        </Text>
        <View style={styles.faqList}>
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <View key={item.question} style={styles.faqCard}>
                <PressableScale
                  style={styles.faqQuestionRow}
                  onPress={() => setOpenIndex(isOpen ? null : index)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}>
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <IconSymbol name={isOpen ? 'chevron.up' : 'chevron.down'} size={16} color={COLORS.textTertiary} />
                </PressableScale>
                {isOpen ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactIcon}>
            <IconSymbol name="questionmark.circle.fill" size={22} color={COLORS.navy} />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Não encontrou o que procurava?</Text>
            <Text style={styles.contactSubtitle}>Fale com a gente pelo WhatsApp ou e-mail.</Text>
          </View>
        </View>

        <Button
          label="Falar no WhatsApp"
          icon="bubble.left.fill"
          onPress={() => openExternal(SUPPORT_WHATSAPP_URL, 'Instale o WhatsApp ou fale com a gente por e-mail.')}
        />

        <PressableScale
          style={styles.contactLink}
          onPress={() => openExternal(`mailto:${SUPPORT_EMAIL}`, `Escreva para ${SUPPORT_EMAIL}.`)}
          accessibilityRole="link"
          accessibilityLabel={`Enviar e-mail para ${SUPPORT_EMAIL}`}>
          <Text style={styles.contactLinkText}>{SUPPORT_EMAIL}</Text>
        </PressableScale>
      </ScreenContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: SPACING.lg,
  },
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  sectionLabel: {
    ...TYPOGRAPHY.overline,
    marginBottom: SPACING.sm,
  },
  faqList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  faqCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 14,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  faqQuestion: {
    flex: 1,
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  faqAnswer: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    lineHeight: 19,
    marginTop: 10,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.medium,
    padding: 14,
    marginBottom: SPACING.md,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactTitle: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  contactSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  contactLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  contactLinkText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
