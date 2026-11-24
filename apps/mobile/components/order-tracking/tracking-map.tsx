import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { getMapboxToken } from '@/services/mapbox';

import { buildTrackingMapHtml, type TrackingMapConfig } from './tracking-map-html';

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
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
