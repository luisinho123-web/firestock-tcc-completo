import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Alert } from '@/components/ui/alert';
import { BottomBar } from '@/components/ui/bottom-bar';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { formatClock, formatPickupDeadline, orderPaymentLabel, orderStatusBadge, useOrders, type Order } from '@/contexts/order-context';
import type { Partner } from '@/data/partners';
import { errorMessage } from '@/services/auth';
import { formatCurrency } from '@/utils/currency';
import { pluralize } from '@/utils/format';

/** O banco só deixa o cliente cancelar até 1 hora antes do fim do prazo (cancel_reservation, RF012). */
const CANCEL_LIMIT_MS = 60 * 60 * 1000;

/**
 * Pedido para retirar na loja: código em destaque para mostrar no balcão, loja com "Como chegar", prazo e etapas.
 * Não há simulação: "Retirado" aparece quando a loja confirma no web-empresa (order-context busca no banco).
 */
export function PickupView({ order, market }: { order: Order; market: Partner }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cancelOrder } = useOrders();
  const pickedUp = order.status === 'entregue';
  const badge = orderStatusBadge(order);
  // Relógio da tela: atualiza a cada 30 s para o prazo e o "pode cancelar" acompanharem a hora.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const deadlinePassed = Boolean(order.pickupDeadline && now > order.pickupDeadline);
  const canCancel = !pickedUp && (!order.pickupDeadline || now < order.pickupDeadline - CANCEL_LIMIT_MS);
  const payOnSite = order.paymentMethod === 'dinheiro';
  const totalItems = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  // Etapas que a loja marca no web-empresa; o app lê do banco a cada poucos segundos.
  const ready = order.status === 'pronto';
  const stepOrder = ['confirmado', 'preparando', 'pronto', 'entregue'] as const;
  const currentIndex = stepOrder.indexOf(order.status as (typeof stepOrder)[number]);
  const timeOf = (status: (typeof stepOrder)[number]) => {
    const at = status === 'confirmado' ? order.createdAt : order.statusTimes[status];
    return at ? formatClock(new Date(at)) : '';
  };
  const steps = [
    { label: 'Pedido recebido', time: timeOf('confirmado') },
    { label: 'Separando o pedido', time: timeOf('preparando') },
    {
      label: 'Pronto para retirar',
      time: timeOf('pronto') || (pickedUp ? '' : `Retire até ${formatPickupDeadline(order.pickupDeadline, now)}`),
    },
    { label: 'Retirado', time: timeOf('entregue') },
  ].map((step, index) => ({
    ...step,
    // A última etapa (retirado) só fica "feita"; as outras ficam feitas quando o pedido já passou delas.
    done: index < currentIndex || (pickedUp && index === currentIndex),
    current: index === currentIndex && !pickedUp,
  }));

  const openDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${market.lat},${market.lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Não foi possível abrir o mapa', market.address));
  };

  const handleCancel = () => {
    Alert.alert('Cancelar reserva?', `Isso cancela a reserva #${order.code} e libera os produtos para outras pessoas.`, [
      { text: 'Manter reserva', style: 'cancel' },
      {
        text: 'Cancelar reserva',
        style: 'destructive',
        onPress: () => {
          cancelOrder(order.id).catch((error) => Alert.alert('Não foi possível cancelar', errorMessage(error)));
        },
      },
    ]);
  };

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + SPACING.sm }]}
        showsVerticalScrollIndicator={false}>
        <ScreenContainer fill={false} style={styles.content}>
          <View style={styles.header}>
            <IconButton
              icon="chevron.left"
              accessibilityLabel="Voltar"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))}
            />
            <Text style={styles.headerTitle} accessibilityRole="header">
              Retirada no local
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.codeCard} accessible accessibilityLabel={`Código de retirada ${order.code.split('').join(' ')}`}>
            <Text style={styles.codeLabel}>
              {pickedUp ? 'Pedido retirado' : ready ? 'Seu pedido está pronto! Mostre este código no balcão' : 'Mostre este código no balcão'}
            </Text>
            <Text style={[styles.codeValue, pickedUp && styles.codeValueDone]} selectable>
              {order.code}
            </Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          {!pickedUp ? (
            <View style={[styles.deadlineCard, deadlinePassed && styles.deadlineCardLate]} accessibilityLiveRegion="polite">
              <IconSymbol name="clock.fill" size={18} color={deadlinePassed ? COLORS.error : COLORS.orange} />
              <Text style={[styles.deadlineText, deadlinePassed && styles.deadlineTextLate]}>
                {deadlinePassed
                  ? 'O prazo de retirada terminou. Fale com a loja antes de ir até lá.'
                  : `Retire até ${formatPickupDeadline(order.pickupDeadline, now)}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.storeRow}>
              <Image source={market.image} style={styles.storeImage} contentFit="cover" />
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{market.name}</Text>
                <Text style={styles.storeAddress} numberOfLines={3}>
                  {order.address || market.address || 'Endereço não informado'}
                </Text>
              </View>
            </View>
            {!pickedUp ? (
              <Button label="Como chegar" icon="map.fill" variant="secondary" size="compact" onPress={openDirections} />
            ) : null}
          </View>

          <View style={styles.card} accessibilityRole="list">
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              return (
                <View
                  key={step.label}
                  style={styles.step}
                  accessible
                  accessibilityLabel={`${step.label}: ${step.done ? 'concluído' : step.current ? 'em andamento' : 'pendente'}${step.time ? `, ${step.time}` : ''}`}>
                  <View style={styles.stepMarkerColumn}>
                    <View style={[styles.stepDot, step.done && styles.stepDotDone, step.current && styles.stepDotCurrent]}>
                      {step.done ? <IconSymbol name="checkmark" size={14} color={COLORS.onDark} /> : null}
                    </View>
                    {!isLast ? <View style={[styles.stepLine, (step.done || step.current) && styles.stepLineDone]} /> : null}
                  </View>
                  <View style={styles.stepText}>
                    <Text style={[styles.stepLabel, !step.done && !step.current && styles.stepLabelPending]}>{step.label}</Text>
                    {step.time ? <Text style={styles.stepTime}>{step.time}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{pluralize(totalItems, 'item', 'itens')}</Text>
              <Text style={styles.rowValue}>{orderPaymentLabel(order)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{payOnSite && !pickedUp ? 'Pagar na loja' : 'Total'}</Text>
              <Text style={styles.rowTotal}>{formatCurrency(order.total)}</Text>
            </View>
          </View>

          {!pickedUp && !canCancel ? (
            <Text style={styles.note}>A reserva só pode ser cancelada até 1 hora antes do fim do prazo.</Text>
          ) : null}
        </ScreenContainer>
      </ScrollView>

      <BottomBar elevated={false}>
        {pickedUp ? (
          <Button
            label={order.reviewed ? 'Ver detalhes do pedido' : 'Avaliar pedido'}
            icon={order.reviewed ? undefined : 'star.fill'}
            onPress={() =>
              order.reviewed
                ? router.replace({ pathname: '/order/[id]', params: { id: order.id } })
                : router.push({ pathname: '/review/[orderId]', params: { orderId: order.id } })
            }
          />
        ) : (
          <>
            <Button label="Preciso de ajuda" variant="ghost" icon="questionmark.circle.fill" onPress={() => router.push('/support')} />
            {canCancel ? (
              <PressableScale style={styles.cancelButton} onPress={handleCancel} accessibilityRole="button">
                <Text style={styles.cancelButtonText}>Cancelar reserva</Text>
              </PressableScale>
            ) : null}
          </>
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xl },
  content: { gap: SPACING.md, paddingHorizontal: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: COLORS.navy, fontSize: FONT_SIZES.h2, fontWeight: FONT_WEIGHTS.heavy },
  headerSpacer: { width: 44 },
  codeCard: {
    backgroundColor: COLORS.navy,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  codeLabel: { color: COLORS.onDarkMuted, fontSize: FONT_SIZES.bodySmall, fontWeight: FONT_WEIGHTS.semibold },
  codeValue: { color: COLORS.onDark, fontSize: 40, fontWeight: FONT_WEIGHTS.heavy, letterSpacing: 2 },
  codeValueDone: { opacity: 0.6 },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 4, marginTop: 4 },
  badgeText: { fontSize: FONT_SIZES.small, fontWeight: FONT_WEIGHTS.bold },
  deadlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.orangeSoft,
    borderRadius: RADIUS.medium,
    padding: SPACING.sm,
  },
  deadlineCardLate: { backgroundColor: COLORS.errorSoft },
  deadlineText: { flex: 1, color: COLORS.navy, fontSize: FONT_SIZES.bodySmall, fontWeight: FONT_WEIGHTS.semibold },
  deadlineTextLate: { color: COLORS.error },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.large, padding: SPACING.md, gap: SPACING.sm },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  storeImage: { width: 48, height: 48, borderRadius: RADIUS.small },
  storeInfo: { flex: 1 },
  storeName: { color: COLORS.navy, fontSize: FONT_SIZES.body, fontWeight: FONT_WEIGHTS.bold },
  storeAddress: { color: COLORS.textTertiary, fontSize: FONT_SIZES.label, marginTop: 2 },
  step: { flexDirection: 'row', gap: SPACING.sm, minHeight: 52 },
  stepMarkerColumn: { alignItems: 'center', width: 24 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.muted,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepDotCurrent: { borderColor: COLORS.orange, backgroundColor: COLORS.orangeSoft },
  stepLine: { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 2 },
  stepLineDone: { backgroundColor: COLORS.success },
  stepText: { flex: 1, paddingBottom: SPACING.sm },
  stepLabel: { color: COLORS.navy, fontSize: FONT_SIZES.body, fontWeight: FONT_WEIGHTS.semibold },
  stepLabelPending: { color: COLORS.textTertiary, fontWeight: FONT_WEIGHTS.regular },
  stepTime: { color: COLORS.textTertiary, fontSize: FONT_SIZES.label, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { color: COLORS.textTertiary, fontSize: FONT_SIZES.body },
  rowValue: { color: COLORS.navy, fontSize: FONT_SIZES.body, fontWeight: FONT_WEIGHTS.semibold },
  rowTotal: { color: COLORS.navy, fontSize: FONT_SIZES.h2, fontWeight: FONT_WEIGHTS.heavy },
  note: { color: COLORS.textTertiary, fontSize: FONT_SIZES.label, textAlign: 'center' },
  cancelButton: { alignItems: 'center', paddingVertical: SPACING.sm },
  cancelButtonText: { color: COLORS.error, fontSize: FONT_SIZES.body, fontWeight: FONT_WEIGHTS.bold },
});
