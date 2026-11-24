import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormScreen } from '@/components/ui/form-screen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SHADOW_SM, SPACING } from '@/components/ui/theme';
import { orderMarket, useOrders } from '@/contexts/order-context';
import { useProfile } from '@/contexts/profile-context';
import { errorMessage } from '@/services/auth';
import { reviewsService } from '@/services/supabase';
import { formatCurrency } from '@/utils/currency';

type Rating = 1 | 2 | 3 | 4 | 5;

const RATING_COPY: Record<Rating, string> = {
  1: 'Poxa! Vamos melhorar para sua próxima compra.',
  2: 'Obrigado por contar. Vamos melhorar.',
  3: 'Valeu! Seu feedback nos ajuda a melhorar.',
  4: 'Boa experiência! Obrigado pelo feedback.',
  5: 'Ótima experiência! Obrigado pelo feedback.',
};

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { orders, markReviewed } = useOrders();
  const { userId } = useProfile();

  const order = orders.find((item) => item.id === orderId);
  const market = orderMarket(order);
  const [rating, setRating] = useState<Rating>(order?.reviewRating ?? 5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!order || !market) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + SPACING.md }]}>
        <ScreenContainer style={styles.notFoundContainer}>
          <ScreenHeader title="Avaliar pedido" />
          <EmptyState icon="star.fill" title="Pedido não encontrado" subtitle="Não foi possível carregar essa avaliação." />
        </ScreenContainer>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await reviewsService.submitOrderReview({ consumerId: userId, marketId: market.id, orderCode: order.code, rating });
      markReviewed(order.id, rating);
      toast.success('Avaliação enviada. Obrigado!');
      router.back();
    } catch (error) {
      Alert.alert('Não foi possível enviar sua avaliação', errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormScreen
      header={<ScreenHeader title="Avaliar pedido" style={styles.header} />}
      footer={
        <Button
          label={order.reviewed ? 'Atualizar avaliação' : 'Enviar avaliação'}
          onPress={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
        />
      }>
      <View style={styles.card}>
        <View style={styles.orderHeader}>
          <Image source={market.image} style={styles.storeImage} contentFit="cover" />
          <View style={styles.orderText}>
            <Text style={styles.marketName}>{market.name}</Text>
            <Text style={styles.orderCode}>Pedido #{order.code}</Text>
          </View>
        </View>

        <Text style={styles.prompt} accessibilityRole="header">
          Como foi sua experiência?
        </Text>

        <View style={styles.starsRow} accessibilityRole="radiogroup" accessibilityLabel="Nota de 1 a 5 estrelas">
          {([1, 2, 3, 4, 5] as const).map((value) => (
            <PressableScale
              key={value}
              style={styles.starButton}
              onPress={() => setRating(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === rating }}
              accessibilityLabel={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}>
              <IconSymbol name="star.fill" size={32} color={value <= rating ? COLORS.warning : COLORS.muted} />
            </PressableScale>
          ))}
        </View>

        <Text style={styles.ratingText}>{rating}/5</Text>
        <Text style={styles.helperText} accessibilityLiveRegion="polite">
          {RATING_COPY[rating]}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Resumo do pedido</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Total</Text>
          <Text style={styles.summaryValue}>{formatCurrency(order.total)}</Text>
        </View>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  notFoundContainer: {
    paddingHorizontal: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW_SM,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 18,
  },
  storeImage: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.input,
  },
  orderText: {
    flex: 1,
    gap: 2,
  },
  marketName: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.subtitle,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  orderCode: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
  },
  prompt: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.title,
    fontWeight: FONT_WEIGHTS.heavy,
    marginBottom: SPACING.lg,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  starButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    color: COLORS.orange,
    fontSize: FONT_SIZES.hero,
    fontWeight: FONT_WEIGHTS.heavy,
    textAlign: 'center',
    marginBottom: SPACING.xxs,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.body,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    padding: 18,
    gap: 10,
  },
  summaryLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.body,
  },
  summaryValue: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
