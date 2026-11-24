import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { useOrders } from '@/contexts/order-context';
import {
  useNotifications,
  type AppNotification,
  type NotificationCategory,
  type NotificationKind,
} from '@/contexts/notifications-context';
import { formatRelativeTime } from '@/utils/date';

type FilterKey = 'todas' | NotificationCategory;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'promocoes', label: 'Promoções' },
  { key: 'conta', label: 'Conta' },
];

const KIND_META: Record<NotificationKind, { icon: IconSymbolName; bg: string; color: string }> = {
  confirmed: { icon: 'checkmark.circle.fill', bg: COLORS.primarySoft, color: COLORS.navy },
  preparing: { icon: 'basket.fill', bg: COLORS.primarySoft, color: COLORS.navy },
  ready: { icon: 'storefront.fill', bg: COLORS.successSoft, color: COLORS.success },
  delivery: { icon: 'truck.fill', bg: COLORS.orangeSoft, color: COLORS.orange },
  delivered: { icon: 'star.fill', bg: COLORS.warningSoft, color: COLORS.warning },
  cancelled: { icon: 'xmark', bg: COLORS.errorSoft, color: COLORS.error },
  promo: { icon: 'percent', bg: COLORS.successSoft, color: COLORS.success },
  coupon: { icon: 'tag.fill', bg: COLORS.primarySoft, color: COLORS.navy },
};

function dayGroupLabel(timestamp: number, now: Date): string {
  const date = new Date(timestamp);
  if (date.toDateString() === now.toDateString()) return 'HOJE';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'ONTEM';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();
}

function groupByDay(items: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const now = new Date();
  const groups: { label: string; items: AppNotification[] }[] = [];
  items.forEach((item) => {
    const label = dayGroupLabel(item.createdAt, now);
    const group = groups.find((entry) => entry.label === label);
    if (group) group.items.push(item);
    else groups.push({ label, items: [item] });
  });
  return groups;
}

const EMPTY_COPY: Record<FilterKey, string> = {
  todas: 'Suas notificações vão aparecer aqui.',
  pedidos: 'Atualizações dos seus pedidos vão aparecer aqui.',
  promocoes: 'Ofertas e cupons vão aparecer aqui.',
  conta: 'Avisos sobre sua conta vão aparecer aqui.',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { orders } = useOrders();
  const [filter, setFilter] = useState<FilterKey>('todas');

  const filtered = filter === 'todas' ? notifications : notifications.filter((item) => item.category === filter);
  const groups = groupByDay(filtered);

  /** Opens whatever the notification is about; notifications for orders that no longer exist just get read. */
  const handleOpen = (item: AppNotification) => {
    markAsRead(item.id);
    const order = item.orderId ? orders.find((entry) => entry.id === item.orderId) : undefined;
    if (order) {
      if (item.kind === 'delivered' && !order.reviewed) {
        router.push({ pathname: '/review/[orderId]', params: { orderId: order.id } });
      } else if (order.status === 'entregue' || order.status === 'cancelado') {
        router.push({ pathname: '/order/[id]', params: { id: order.id } });
      } else {
        router.push({ pathname: '/order-tracking', params: { id: order.id } });
      }
    } else if (item.category === 'promocoes') {
      router.dismissTo('/markets');
    }
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top + SPACING.md }]}>
      <ScreenContainer style={styles.container}>
        <ScreenHeader
          title="Notificações"
          right={
            unreadCount > 0 ? (
              <PressableScale onPress={markAllAsRead} hitSlop={10} accessibilityRole="button" style={styles.readAllButton}>
                <Text style={styles.readAllText}>Ler todas</Text>
              </PressableScale>
            ) : undefined
          }
        />

        <View style={styles.filtersRow}>
          {FILTERS.map((item) => {
            const isActive = filter === item.key;
            return (
              <PressableScale
                key={item.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilter(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={
                  item.key === 'todas' && unreadCount > 0 ? `${item.label}, ${unreadCount} não lidas` : item.label
                }>
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{item.label}</Text>
                {item.key === 'todas' && unreadCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{unreadCount}</Text>
                  </View>
                ) : null}
              </PressableScale>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <EmptyState icon="bell.fill" title="Nenhuma notificação" subtitle={EMPTY_COPY[filter]} />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.lg }]}
            showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.label} style={styles.group}>
                <Text style={styles.groupLabel} accessibilityRole="header">
                  {group.label}
                </Text>
                {group.items.map((item) => {
                  const meta = KIND_META[item.kind];
                  return (
                    <PressableScale
                      key={item.id}
                      style={styles.card}
                      onPress={() => handleOpen(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.read ? '' : 'Não lida. '}${item.title}. ${item.message}. ${formatRelativeTime(
                        new Date(item.createdAt)
                      )}`}>
                      <View style={[styles.cardIcon, { backgroundColor: meta.bg }]}>
                        <IconSymbol name={meta.icon} size={20} color={meta.color} />
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                          <Text style={styles.cardTitle}>{item.title}</Text>
                          <View style={styles.cardTimeRow}>
                            <Text style={styles.cardTime}>{formatRelativeTime(new Date(item.createdAt))}</Text>
                            {!item.read ? <View style={styles.unreadDot} /> : null}
                          </View>
                        </View>
                        <Text style={styles.cardMessage}>{item.message}</Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    paddingHorizontal: SPACING.lg,
  },
  readAllButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  readAllText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  filterChipActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  filterChipText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
  filterChipTextActive: {
    color: COLORS.onDark,
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  scrollContent: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  group: {
    gap: SPACING.sm,
  },
  groupLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.4,
  },
  card: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: SPACING.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  cardTitle: {
    flex: 1,
    color: COLORS.navy,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  cardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTime: {
    color: COLORS.textFaint,
    fontSize: FONT_SIZES.caption,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.orange,
  },
  cardMessage: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    lineHeight: 18,
  },
});
