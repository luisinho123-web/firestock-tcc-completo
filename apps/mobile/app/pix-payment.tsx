import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { QrCode } from '@/components/ui/qr-code';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { useCart } from '@/contexts/cart-context';
import { orderMarket, useOrders, type Order } from '@/contexts/order-context';
import { useFlash } from '@/hooks/use-flash';
import { formatCurrency } from '@/utils/currency';
import { buildPixPayload, getPixConfig } from '@/utils/pix';

const COUNTDOWN_SECONDS = 15 * 60;
/** Demo only: no payment provider yet, so the Pix is "paid" automatically after a few seconds. This only runs while
 * no real Pix key is configured (EXPO_PUBLIC_PIX_KEY); with a real key the person confirms with "Já paguei". */
const AUTO_CONFIRM_MS = 7000;

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

export default function PixPaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders } = useOrders();

  const order = orders.find((item) => item.id === id);

  if (!order) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + SPACING.md }]}>
        <ScreenContainer style={styles.container}>
          <ScreenHeader title="Pagamento via Pix" />
          <EmptyState
            icon="qrcode"
            title="Pagamento não encontrado"
            subtitle="Esse pagamento expirou ou já foi concluído."
            actionLabel="Ver meus pedidos"
            onAction={() => router.dismissTo('/orders')}
          />
        </ScreenContainer>
      </View>
    );
  }

  return <PixPayment order={order} />;
}

function PixPayment({ order }: { order: Order }) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { discardOrder } = useOrders();
  const { addItems } = useCart();
  const market = orderMarket(order);
  const pix = useMemo(getPixConfig, []);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [copied, flashCopied] = useFlash(2000);
  // Set right before this screen navigates away on its own, so the leave guard below lets it through.
  const leavingRef = useRef(false);

  const confirmPayment = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    router.replace({ pathname: '/order-confirmation', params: { id: order.id } });
  };
  const autoConfirm = useEffectEvent(confirmPayment);

  /** Backing out of an unpaid Pix: drop the order and put its items back in the cart. */
  const abandonPayment = () => {
    leavingRef.current = true;
    discardOrder(order.id);
    addItems(order.lines.map((line) => ({ id: line.productId, quantity: line.quantity })));
  };

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    // Com chave Pix real o QR é pagável de verdade: não confirma sozinho (senão a tela sairia antes de a pessoa pagar).
    const timer = pix.isPlaceholder ? setTimeout(() => autoConfirm(), AUTO_CONFIRM_MS) : undefined;
    return () => {
      clearInterval(tick);
      if (timer) clearTimeout(timer);
    };
    // pix vem do .env e não muda com a tela aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back button, Android back and the iOS swipe all land here: confirm before dropping the order.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (leavingRef.current) return;
        event.preventDefault();
        Alert.alert('Cancelar pagamento?', 'O pedido ainda não foi pago. Os itens voltam para o seu carrinho.', [
          { text: 'Continuar pagando', style: 'cancel' },
          {
            text: 'Sair',
            style: 'destructive',
            onPress: () => {
              abandonPayment();
              navigation.dispatch(event.data.action);
            },
          },
        ]);
      }),
    // abandonPayment only closes over stable context setters and this order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, order.id]
  );

  const code = useMemo(
    () => buildPixPayload({ key: pix.key, name: pix.name, city: pix.city, amount: order.total, txid: order.code }),
    [pix, order.total, order.code]
  );

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      flashCopied();
    } catch {
      Alert.alert('Não foi possível copiar', 'Selecione e copie o código manualmente.');
    }
  };

  const handleOtherMethod = () => {
    abandonPayment();
    router.replace('/checkout');
  };

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + SPACING.md, paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xs },
        ]}
        showsVerticalScrollIndicator={false}>
        <ScreenContainer style={styles.container}>
          <ScreenHeader title="Pagamento via Pix" style={styles.header} />

          <View style={styles.timerPill} accessible accessibilityLabel={`Pague em até ${Math.ceil(secondsLeft / 60)} minutos`}>
            <IconSymbol name="clock.fill" size={14} color={COLORS.orange} />
            <Text style={styles.timerText}>Pague em até {formatCountdown(secondsLeft)}</Text>
          </View>

          <Text style={styles.amount}>{formatCurrency(order.total)}</Text>
          <Text style={styles.orderSubtitle}>
            Pedido #{order.code}
            {market ? ` · ${market.name}` : ''}
          </Text>

          <View style={styles.qrCard} accessible accessibilityRole="image" accessibilityLabel="QR Code do Pix">
            <QrCode value={code} size={240} />
          </View>
          {__DEV__ && pix.isPlaceholder ? (
            <Text style={styles.devHint}>Chave Pix de teste (ninguém recebe). Defina EXPO_PUBLIC_PIX_KEY no .env.local.</Text>
          ) : null}

          <Text style={styles.label}>Pix copia e cola</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText} numberOfLines={1} selectable>
              {code}
            </Text>
            <PressableScale
              style={[styles.copyButton, copied && styles.copyButtonDone]}
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Código copiado' : 'Copiar código Pix'}>
              <Text style={styles.copyButtonText}>{copied ? 'Copiado!' : 'Copiar'}</Text>
            </PressableScale>
          </View>

          <View style={styles.progressRow} accessibilityLiveRegion="polite">
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
            <Text style={styles.progressText}>Aguardando pagamento...</Text>
          </View>

          <View style={styles.spacerFlex} />

          <Button label="Já paguei" onPress={confirmPayment} />
          <PressableScale style={styles.otherMethodLink} onPress={handleOtherMethod} accessibilityRole="button">
            <Text style={styles.otherMethodText}>Escolher outra forma de pagamento</Text>
          </PressableScale>
        </ScreenContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
  },
  container: {
    flexGrow: 1,
  },
  header: {
    marginBottom: SPACING.md,
  },
  timerPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.orangeSoft,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: SPACING.sm,
  },
  timerText: {
    color: COLORS.orange,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  amount: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.hero,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  orderSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    marginBottom: SPACING.lg,
  },
  qrCard: {
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 14,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  devHint: {
    alignSelf: 'center',
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    textAlign: 'center',
    marginTop: -SPACING.sm,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.navy,
    marginBottom: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    paddingLeft: 14,
    paddingRight: 6,
    height: 52,
  },
  codeText: {
    flex: 1,
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  copyButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonDone: {
    backgroundColor: COLORS.success,
  },
  copyButtonText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.navy,
  },
  progressText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    marginLeft: 4,
  },
  spacerFlex: {
    flex: 1,
    minHeight: SPACING.xl,
  },
  otherMethodLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  otherMethodText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
