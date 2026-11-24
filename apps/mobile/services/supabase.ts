import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { createNotificationPrefsService } from './notification-prefs';
import { createProfileService } from './profile';
import { createReservationsService } from './reservations';
import {
  createAddressesService,
  createFavoritesService,
  createPaymentMethodsService,
  createReviewsService,
} from './user-data';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local (veja .env.example) e reinicie o Expo.',
  );
}

// The static web export renders on the server, where there is no localStorage for AsyncStorage to use.
const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(canPersist ? { storage: AsyncStorage } : {}),
    persistSession: canPersist,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export const profileService = createProfileService(supabase);
export const addressesService = createAddressesService(supabase);
export const favoritesService = createFavoritesService(supabase);
export const paymentMethodsService = createPaymentMethodsService(supabase);
export const reviewsService = createReviewsService(supabase);
export const reservationsService = createReservationsService(supabase);
export const notificationPrefsService = createNotificationPrefsService(supabase);
