import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/components/ui/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenContainer } from '@/components/ui/screen-container';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { useAddresses } from '@/contexts/addresses-context';
import { useCart } from '@/contexts/cart-context';
import { useFavorites } from '@/contexts/favorites-context';
import { useNotificationPrefs } from '@/contexts/notification-prefs-context';
import { useNotifications } from '@/contexts/notifications-context';
import { useOrders } from '@/contexts/order-context';
import { useProfile } from '@/contexts/profile-context';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { signOutUser } from '@/services/auth';
import { formatCurrency } from '@/utils/currency';
import { initials } from '@/utils/format';

type MenuRow = {
  key: string;
  label: string;
  subtitle: string;
  icon: IconSymbolName;
  href: Href;
  badge?: number;
};

function buildAccountRows(addressCount: number): MenuRow[] {
  return [
    { key: 'account', label: 'Dados da conta', subtitle: 'Nome, e-mail e telefone', icon: 'doc.text.fill', href: '/account' },
    {
      key: 'addresses',
      label: 'Endereços',
      subtitle: `${addressCount} ${addressCount === 1 ? 'endereço salvo' : 'endereços salvos'}`,
      icon: 'location.fill',
      href: '/addresses',
    },
    { key: 'payments', label: 'Pagamentos', subtitle: 'Pix, cartões e dinheiro', icon: 'creditcard.fill', href: '/payments' },
    {
      key: 'notification-settings',
      label: 'Preferências de notificação',
      subtitle: 'Aviso no celular ou WhatsApp',
      icon: 'bell.fill',
      href: '/notification-settings',
    },
  ];
}

function buildActivityRows(unreadNotifications: number): MenuRow[] {
  return [
    { key: 'orders', label: 'Meus pedidos', subtitle: 'Histórico e acompanhamento', icon: 'shippingbox.fill', href: '/orders' },
    {
      key: 'notifications',
      label: 'Notificações',
      subtitle: 'Ofertas e status de pedidos',
      icon: 'bell.fill',
      href: '/notifications',
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    },
  ];
}

const SUPPORT_ROWS: MenuRow[] = [
  {
    key: 'support',
    label: 'Ajuda e suporte',
    subtitle: 'Dúvidas sobre pedidos e pagamentos',
    icon: 'questionmark.circle.fill',
    href: '/support',
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name, email, avatarUrl, setName, setEmail, setToken, setIsAuthenticated } = useProfile();
  const { favoriteIds } = useFavorites();
  const { clearCart } = useCart();
  const { orders } = useOrders();
  const { addresses } = useAddresses();
  const { unreadCount } = useNotifications();
  const { unregisterThisDevice } = useNotificationPrefs();
  useStatusBarStyle('light');

  const accountRows = buildAccountRows(addresses.length);
  const activityRows = buildActivityRows(unreadCount);

  const displayName = name.trim() || 'Usuário';
  const userEmail = email.trim() || 'Sem e-mail cadastrado';

  // Coupon discounts on orders that weren't cancelled — what the shopper actually kept.
  const totalSaved = orders.filter((order) => order.status !== 'cancelado').reduce((sum, order) => sum + order.discount, 0);

  const handleLogout = () => {
    Alert.alert('Sair da conta?', 'Você precisará entrar de novo para fazer pedidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          // Tira este aparelho da lista de push enquanto ainda há sessão (depois de sair, o servidor não deixaria apagar).
          await unregisterThisDevice();
          // If the network call fails the local session is still dropped by supabase-js; clear the UI either way.
          await signOutUser().catch(() => undefined);
          clearCart();
          setName('');
          setEmail('');
          setToken('');
          setIsAuthenticated(false);
          router.dismissTo('/onboarding');
        },
      },
    ]);
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerGlowLarge} />
        <View style={styles.headerGlowSmall} />
        <ScreenContainer fill={false} style={[styles.headerContent, { paddingTop: insets.top + 19 }]}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Meu perfil
            </Text>
          </View>

          <View style={styles.headerProfileRow}>
            <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials(name) || '?'}</Text>
              )}
            </View>
            <View style={styles.headerProfileInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.headerEmail} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
            <PressableScale
              style={styles.editButton}
              onPress={() => router.push('/account')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Editar dados da conta">
              <IconSymbol name="pencil" size={14} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Editar</Text>
            </PressableScale>
          </View>
        </ScreenContainer>
      </View>

      <ScreenContainer style={styles.screenContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statsCard}>
            <PressableScale
              style={styles.statItem}
              onPress={() => router.navigate('/orders')}
              accessibilityRole="button"
              accessibilityLabel={`${orders.length} pedidos`}>
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statLabel}>Pedidos</Text>
            </PressableScale>
            <View style={styles.statDivider} />
            <View style={styles.statItem} accessible accessibilityLabel={`${formatCurrency(totalSaved)} economizados com cupons`}>
              <Text style={[styles.statValue, styles.statValueGreen]} adjustsFontSizeToFit numberOfLines={1}>
                {formatCurrency(totalSaved)}
              </Text>
              <Text style={styles.statLabel}>Economizados</Text>
            </View>
            <View style={styles.statDivider} />
            <PressableScale
              style={styles.statItem}
              onPress={() => router.push('/favorites')}
              accessibilityRole="button"
              accessibilityLabel={`${favoriteIds.length} favoritos`}>
              <Text style={styles.statValue}>{favoriteIds.length}</Text>
              <Text style={styles.statLabel}>Favoritos</Text>
            </PressableScale>
          </View>

          <MenuGroup title="MINHA CONTA" rows={accountRows} onPressRow={(href) => router.push(href)} />
          <MenuGroup title="ATIVIDADE" rows={activityRows} onPressRow={(href) => router.push(href)} />
          <MenuGroup title="SUPORTE" rows={SUPPORT_ROWS} onPressRow={(href) => router.push(href)} />

          <PressableScale style={styles.logoutRow} onPress={handleLogout} accessibilityRole="button">
            <View style={styles.logoutIcon}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={COLORS.error} />
            </View>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </PressableScale>
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

function MenuGroup({ title, rows, onPressRow }: { title: string; rows: MenuRow[]; onPressRow: (href: Href) => void }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.groupCard}>
        {rows.map((row, index) => (
          <PressableScale
            key={row.key}
            style={[styles.menuRow, index === rows.length - 1 && styles.menuRowLast]}
            onPress={() => onPressRow(row.href)}
            accessibilityRole="button"
            accessibilityLabel={row.badge ? `${row.label}, ${row.badge} não lidas` : row.label}
            accessibilityHint={row.subtitle}>
            <View style={styles.menuIcon}>
              <IconSymbol name={row.icon} size={20} color={COLORS.navy} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>{row.label}</Text>
              <Text style={styles.menuSubtitle}>{row.subtitle}</Text>
            </View>
            {row.badge ? (
              <View style={styles.menuBadge}>
                <Text style={styles.menuBadgeText}>{row.badge}</Text>
              </View>
            ) : null}
            <IconSymbol name="chevron.right" size={18} color={COLORS.textFaint} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.navy,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  headerGlowLarge: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.onDarkGlow,
    right: -60,
    top: -90,
  },
  headerGlowSmall: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.onDarkGlow,
    left: -50,
    bottom: -60,
  },
  headerContent: {
    paddingHorizontal: SPACING.lg,
    // Deep enough for the stats card to overlap the navy by 48pt, as in the design.
    paddingBottom: 76,
    gap: 26,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: COLORS.onDark,
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.bold,
  },
  headerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 67,
    height: 67,
    borderRadius: 33.5,
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: COLORS.onDark,
    fontSize: 24,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  headerProfileInfo: {
    flex: 1,
    gap: 2,
  },
  headerName: {
    color: COLORS.onDark,
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  headerEmail: {
    color: COLORS.onDarkMuted,
    fontSize: 13,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
  },
  editButtonText: {
    color: COLORS.onDark,
    fontSize: 13,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  screenContainer: {
    flex: 1,
    marginTop: -48,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    paddingVertical: 16,
    shadowColor: COLORS.navy,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  statValue: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  statValueGreen: {
    color: COLORS.success,
  },
  statLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
  },
  group: {
    gap: 12,
  },
  groupTitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.6,
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    color: COLORS.navy,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
  },
  menuSubtitle: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.label,
  },
  menuBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeText: {
    color: COLORS.onDark,
    fontSize: FONT_SIZES.caption,
    fontWeight: FONT_WEIGHTS.heavy,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
