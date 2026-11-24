import { Stack } from 'expo-router';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { LocationSync } from '@/components/location-sync';
import { PushTapHandler } from '@/components/push-tap-handler';
import { AlertHost } from '@/components/ui/alert-host';
import { ToastHost } from '@/components/ui/toast-host';
import { AnimatedSplash } from '@/components/ui/animated-splash';
import { COLORS } from '@/components/ui/theme';
import { AddressesProvider } from '@/contexts/addresses-context';
import { CartProvider } from '@/contexts/cart-context';
import { CatalogProvider, useCatalog } from '@/contexts/catalog-context';
import { FavoritesProvider } from '@/contexts/favorites-context';
import { NotificationPrefsProvider } from '@/contexts/notification-prefs-context';
import { NotificationsProvider } from '@/contexts/notifications-context';
import { OrderProvider } from '@/contexts/order-context';
import { PaymentMethodsProvider } from '@/contexts/payment-methods-context';
import { ProfileProvider, useProfile } from '@/contexts/profile-context';
import { configureNotificationHandler } from '@/services/push';

SplashScreen.preventAutoHideAsync();
// Avisos de pedido que chegam com o app aberto aparecem como banner (igual a quando ele está fechado).
configureNotificationHandler();

// The visual design is light-only (app.json pins userInterfaceStyle to "light"), so navigation chrome
// uses the same tokens as the screens — no dark flash between transitions.
const NAVIGATION_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.navy,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.navy,
    border: COLORS.border,
  },
};

// Screens reachable without an account: the welcome flow and password recovery (its link opens new-password).
// Everything else needs a signed-in user — there is no guest mode, so a signed-out visit (typed URL, stale tab,
// sign-out) is sent back to the start instead of showing the app.
function AppStack() {
  const { isAuthenticated, isRestoringSession } = useProfile();
  const { ready } = useCatalog();

  // Enquanto a sessão salva é restaurada ainda não se sabe se há login: avaliar a trava agora mandaria quem recarregou uma
  // tela (ex.: Pedidos) de volta ao início. Espera, e a rota da URL é aberta já com a resposta certa.
  if (isRestoringSession) return null;
  // Logado, espera o primeiro carregamento das empresas e produtos reais para as telas já nascerem completas.
  if (isAuthenticated && !ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="new-password" />
      <Stack.Screen name="auth-callback" />
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="order-confirmation" options={{ gestureEnabled: false }} />
        <Stack.Screen name="pix-payment" options={{ gestureEnabled: false }} />
        <Stack.Screen name="account" />
        <Stack.Screen name="add-card" />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="market/[id]" />
        <Stack.Screen name="new-address" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="order-tracking" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="review/[orderId]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="support" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [introVisible, setIntroVisible] = useState(true);

  // Nothing to preload (the app uses system fonts), so hand over from the native splash to the
  // animated one as soon as the first frame is mounted.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Browsers draw a black focus ring around inputs (the fields already show their own navy focus border) and
  // Edge adds its own "reveal password" eye next to the app's, so both native decorations are switched off.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = [
      'input, textarea, [role="button"]:focus { outline: none !important; box-shadow: none !important; }',
      'input::-ms-reveal, input::-ms-clear { display: none !important; }',
    ].join('\n');
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ProfileProvider>
        <NotificationPrefsProvider>
        <CatalogProvider>
        <AddressesProvider>
          <PaymentMethodsProvider>
            <FavoritesProvider>
              <CartProvider>
                <OrderProvider>
                  <NotificationsProvider>
                    <ThemeProvider value={NAVIGATION_THEME}>
                      <AppStack />
                      <StatusBar style="dark" />
                      {introVisible ? <AnimatedSplash onFinish={() => setIntroVisible(false)} /> : null}
                      <LocationSync />
                      {Platform.OS !== 'web' ? <PushTapHandler /> : null}
                      <AlertHost />
                      <ToastHost />
                    </ThemeProvider>
                  </NotificationsProvider>
                </OrderProvider>
              </CartProvider>
            </FavoritesProvider>
          </PaymentMethodsProvider>
        </AddressesProvider>
        </CatalogProvider>
        </NotificationPrefsProvider>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}
