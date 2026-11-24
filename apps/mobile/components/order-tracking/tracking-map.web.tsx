import { createElement, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { getMapboxToken } from '@/services/mapbox';

import { buildTrackingMapHtml, type TrackingMapConfig } from './tracking-map-html';

/** Web build has no react-native-webview host — an <iframe srcDoc> renders the same Leaflet page instead. */
export function TrackingMap({ config, style }: { config: TrackingMapConfig; style?: StyleProp<ViewStyle> }) {
  // Keyed on the primitives, not the object: callers pass a fresh literal every render, and a new HTML
  // string makes the map reload from scratch (tiles, route request and all).
  const { store, home, progress } = config;
  const mapboxToken = getMapboxToken();
  const html = useMemo(
    () =>
      buildTrackingMapHtml({
        store: { lat: store.lat, lng: store.lng },
        home: { lat: home.lat, lng: home.lng },
        progress,
        mapboxToken,
      }),
    [store.lat, store.lng, home.lat, home.lng, progress, mapboxToken]
  );

  return (
    <View style={[styles.container, style]}>
      {createElement('iframe', {
        srcDoc: html,
        style: { border: 0, width: '100%', height: '100%' },
        title: 'Mapa de acompanhamento do pedido',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
