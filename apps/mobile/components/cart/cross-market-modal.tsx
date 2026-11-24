import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import type { Partner } from '@/data/partners';
import { formatCurrency } from '@/utils/currency';
import { pluralize } from '@/utils/format';

type CrossMarketModalProps = {
  currentMarket: Partner;
  currentItemCount: number;
  currentTotal: number;
  incomingMarket: Partner;
  /** What the shopper tried to add: a product name, or e.g. "os itens do pedido anterior". */
  incomingDescription: string;
  incomingItemCount: number;
  incomingTotal: number;
  onKeep: () => void;
  onReplace: () => void;
};

export function CrossMarketModal({
  currentMarket,
  currentItemCount,
  currentTotal,
  incomingMarket,
  incomingDescription,
  incomingItemCount,
  incomingTotal,
  onKeep,
  onReplace,
}: CrossMarketModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onKeep}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onKeep} accessibilityRole="button" accessibilityLabel="Fechar" />

        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.xs }]}
          accessibilityViewIsModal>
          <View style={styles.handle} />

          <View style={styles.icon}>
            <IconSymbol name="cart.fill" size={26} color={COLORS.orange} />
          </View>

          <Text style={styles.title} accessibilityRole="header">
            Seu carrinho tem itens de outro mercado
          </Text>
          <Text style={styles.subtitle}>
            Cada pedido é feito em um único mercado. Para adicionar {incomingDescription} do {incomingMarket.name}, o carrinho
            atual será limpo.
          </Text>

          <View style={styles.compareRow}>
            <View style={styles.compareItem}>
              <Image source={currentMarket.image} style={styles.compareImage} contentFit="cover" />
              <View style={styles.compareText}>
                <Text style={styles.compareLabel} numberOfLines={1}>
                  {currentMarket.name}
                </Text>
                <Text style={styles.compareDetail}>
                  {pluralize(currentItemCount, 'item', 'itens')} · {formatCurrency(currentTotal)}
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={COLORS.textFaint} />
            <View style={styles.compareItem}>
              <Image source={incomingMarket.image} style={styles.compareImage} contentFit="cover" />
              <View style={styles.compareText}>
                <Text style={styles.compareLabel} numberOfLines={1}>
                  {incomingMarket.name}
                </Text>
                <Text style={styles.compareDetail}>
                  {pluralize(incomingItemCount, 'item', 'itens')} · {formatCurrency(incomingTotal)}
                </Text>
              </View>
            </View>
          </View>

          <Button label="Limpar carrinho e adicionar" onPress={onReplace} />
          <Button label="Manter meu carrinho" variant="ghost" onPress={onKeep} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.scrim,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  icon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.h1,
    fontWeight: FONT_WEIGHTS.heavy,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.medium,
    padding: 10,
    marginBottom: SPACING.sm,
  },
  compareItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compareText: {
    flex: 1,
  },
  compareImage: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  compareLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
  },
  compareDetail: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
  },
});
