export type RoutePoint = {
  lat: number;
  lng: number;
};

export type TrackingMapConfig = {
  store: RoutePoint;
  home: RoutePoint;
  /** How far along the road route the courier marker sits: 0 = at the store, 1 = at the door. */
  progress: number;
  /** EXPO_PUBLIC_MAPBOX_TOKEN, if configured. Only swaps the tile *imagery* — routing still comes from
   * OSRM either way. Without it, falls back to the OpenStreetMap tiles below, unchanged. */
  mapboxToken?: string;
};

/**
 * Builds a self-contained Leaflet page (no API key required) that plots the delivery route. The page
 * itself fetches the real driving route from the public OSRM demo server (free, no key) so the
 * road-following polyline and the courier's position on it are computed in one place, shared by both
 * the native WebView and the web <iframe> hosts. If OSRM is unreachable, it falls back to a straight
 * dashed line between the two points so the map still renders. Map tiles come from Mapbox when a token
 * is configured (nicer styling), or from OpenStreetMap otherwise — either way, routing is unaffected.
 */
export function buildTrackingMapHtml(config: TrackingMapConfig): string {
  const data = JSON.stringify(config);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #F8FAFC; }
    .marker-pin {
      width: 40px; height: 40px; border-radius: 14px; border: 3px solid #FFFFFF;
      display: flex; align-items: center; justify-content: center; font-size: 18px;
      box-shadow: 0 6px 12px rgba(0,8,81,0.25);
    }
    .marker-store { background: #000851; }
    .marker-courier { background: #F05219; width: 48px; height: 48px; border-radius: 16px; font-size: 22px; transition: transform 0.2s ease; }
    .marker-home { background: #FFFFFF; color: #000851; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    crossorigin=""
  ></script>
  <script>
    const config = ${data};
    const map = L.map('map', { zoomControl: false, attributionControl: true });

    if (config.mapboxToken) {
      // Mapbox's Styles API serves 512px tiles (vs. OSM's 256px), so tileSize/zoomOffset must match or
      // the map renders blurry and misaligned. detectRetina + {r} picks up @2x tiles on high-DPI screens.
      L.tileLayer(
        'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}{r}?access_token=' + config.mapboxToken,
        {
          maxZoom: 19,
          tileSize: 512,
          zoomOffset: -1,
          detectRetina: true,
          attribution: '&copy; Mapbox &copy; OpenStreetMap',
        }
      ).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
    }

    const icons = {
      store: L.divIcon({ className: '', html: '<div class="marker-pin marker-store">🏬</div>', iconSize: [40, 40], iconAnchor: [20, 20] }),
      courier: L.divIcon({ className: '', html: '<div class="marker-pin marker-courier">🛵</div>', iconSize: [48, 48], iconAnchor: [24, 24] }),
      home: L.divIcon({ className: '', html: '<div class="marker-pin marker-home">🏠</div>', iconSize: [40, 40], iconAnchor: [20, 20] }),
    };

    L.marker([config.store.lat, config.store.lng], { icon: icons.store }).addTo(map);
    L.marker([config.home.lat, config.home.lng], { icon: icons.home }).addTo(map);
    const courierMarker = L.marker([config.store.lat, config.store.lng], { icon: icons.courier }).addTo(map);

    function pointAtProgress(latLngs, t) {
      if (latLngs.length < 2) return latLngs[0];
      const segments = [];
      let total = 0;
      for (let i = 0; i < latLngs.length - 1; i += 1) {
        const d = map.distance(latLngs[i], latLngs[i + 1]);
        segments.push(d);
        total += d;
      }
      let target = total * Math.min(Math.max(t, 0), 1);
      for (let i = 0; i < segments.length; i += 1) {
        if (target <= segments[i] || i === segments.length - 1) {
          const ratio = segments[i] === 0 ? 0 : target / segments[i];
          const [aLat, aLng] = latLngs[i];
          const [bLat, bLng] = latLngs[i + 1];
          return [aLat + (bLat - aLat) * ratio, aLng + (bLng - aLng) * ratio];
        }
        target -= segments[i];
      }
      return latLngs[latLngs.length - 1];
    }

    function drawStraightFallback() {
      const latLngs = [
        [config.store.lat, config.store.lng],
        [config.home.lat, config.home.lng],
      ];
      L.polyline(latLngs, { color: '#000851', weight: 3, opacity: 0.35, dashArray: '1 10', lineCap: 'round' }).addTo(map);
      const courierPos = pointAtProgress(latLngs, config.progress);
      courierMarker.setLatLng(courierPos);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [56, 56] });
    }

    const osrmUrl =
      'https://router.project-osrm.org/route/v1/driving/' +
      config.store.lng + ',' + config.store.lat + ';' + config.home.lng + ',' + config.home.lat +
      '?overview=full&geometries=geojson';

    fetch(osrmUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('osrm_http_' + res.status))))
      .then((data) => {
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) throw new Error('osrm_no_route');
        const latLngs = coords.map(([lng, lat]) => [lat, lng]);
        L.polyline(latLngs, { color: '#000851', weight: 4, opacity: 0.55, lineCap: 'round', lineJoin: 'round' }).addTo(map);
        const courierPos = pointAtProgress(latLngs, config.progress);
        courierMarker.setLatLng(courierPos);
        map.fitBounds(L.latLngBounds(latLngs), { padding: [56, 56] });
      })
      .catch(drawStraightFallback);

    map.fitBounds(
      L.latLngBounds([
        [config.store.lat, config.store.lng],
        [config.home.lat, config.home.lng],
      ]),
      { padding: [56, 56] },
    );
  </script>
</body>
</html>`;
}
