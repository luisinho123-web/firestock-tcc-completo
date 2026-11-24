/** Mapbox geocoding + Static Images URL: pure, fetch/timeout/token injectable so it runs under plain Node.
 * Unlike services/supabase.ts, a missing token here never throws — the map is an enhancement, not a
 * requirement: without it, geocodeAddress and staticMapUrl just return null/undefined and callers fall
 * back to what the app already does without Mapbox.
 * Base: plano docs/superpowers/plans/2026-09-28-viacep-mapbox-avatar.md (Task 2). */

export type Coordinates = { lat: number; lng: number };

const DEFAULT_TIMEOUT_MS = 8000;
/** COLORS.orange from components/ui/theme.ts, without the '#' the Mapbox pin marker syntax expects. */
const PIN_COLOR = 'f05219';

export function getMapboxToken(): string | undefined {
  return process.env.EXPO_PUBLIC_MAPBOX_TOKEN || undefined;
}

type GeocodeResponse = { features?: { geometry?: { coordinates?: [number, number] } }[] };

export async function geocodeAddress(
  query: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; token?: string } = {},
): Promise<Coordinates | null> {
  const token = options.token ?? getMapboxToken();
  if (!token) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&country=br&limit=1&access_token=${encodeURIComponent(token)}`;

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return null;

    const data = (await response.json()) as GeocodeResponse;
    // GeoJSON order is [longitude, latitude] — swapped here on purpose, don't "simplify" this back.
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (!coordinates) return null;
    const [lng, lat] = coordinates;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function staticMapUrl(params: {
  lat: number;
  lng: number;
  width?: number;
  height?: number;
  zoom?: number;
  token?: string;
}): string | null {
  const token = params.token ?? getMapboxToken();
  if (!token) return null;

  const { lat, lng, width = 400, height = 160, zoom = 15 } = params;
  const pin = `pin-s+${PIN_COLOR}(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
}
