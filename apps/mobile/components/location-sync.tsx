import * as Location from 'expo-location';
import { useEffect } from 'react';

import { notifyCatalogChanged } from '@/contexts/catalog-context';
import { useAddresses } from '@/contexts/addresses-context';
import { useProfile } from '@/contexts/profile-context';
import { setUserLocation } from '@/data/partners';
import { isValidCoordinate } from '@/services/distance-core';

// O GPS e o endereço escolhido escrevem no mesmo lugar; este marcador evita o endereço sobrescrever uma posição de GPS já obtida.
let gpsFix = false;

/**
 * Mantém a distância até as empresas em tempo real: acompanha o GPS (com a permissão do usuário) e, enquanto não há GPS
 * ou se a permissão for negada, usa o endereço escolhido (ou o padrão) como ponto de partida. Não desenha nada.
 */
export function LocationSync() {
  const { isAuthenticated } = useProfile();
  const { selectedAddress, addresses } = useAddresses();
  const fallback = selectedAddress ?? addresses.find((address) => address.isDefault) ?? addresses[0];
  const fallbackLat = fallback?.lat;
  const fallbackLng = fallback?.lng;

  // GPS: a cada ~100 m de deslocamento (ou 30 s), atualiza a posição e, com ela, todas as distâncias.
  useEffect(() => {
    if (!isAuthenticated) {
      gpsFix = false;
      setUserLocation(null);
      notifyCatalogChanged();
      return;
    }

    let active = true;
    let subscription: Location.LocationSubscription | undefined;

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active || !permission.granted) return;

        const apply = (coords: { latitude: number; longitude: number }) => {
          if (!active) return;
          gpsFix = true;
          setUserLocation({ lat: coords.latitude, lng: coords.longitude });
          notifyCatalogChanged();
        };

        const last = await Location.getLastKnownPositionAsync();
        if (last) apply(last.coords);

        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 30_000 },
          (position) => apply(position.coords),
        );
      } catch {
        // sem GPS (aparelho sem serviço, navegador bloqueou): segue com o endereço escolhido
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [isAuthenticated]);

  // Endereço escolhido: só vale enquanto o GPS não deu posição (o GPS é mais fiel ao "onde estou agora").
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isValidCoordinate({ lat: fallbackLat, lng: fallbackLng })) return;
    if (gpsFix) return;
    setUserLocation({ lat: fallbackLat as number, lng: fallbackLng as number });
    notifyCatalogChanged();
  }, [isAuthenticated, fallbackLat, fallbackLng]);

  return null;
}

