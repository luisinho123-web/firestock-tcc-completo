/**
 * Cálculo e formatação de distância. Sem dependências do React Native, para poder ser testado à parte.
 *
 * ATENÇÃO: arquivo RECRIADO (o original não veio no pacote do projeto). Confira o texto de formatDistance.
 */

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Coordenada com latitude em [-90, 90] e longitude em [-180, 180]; aceita lixo (null, NaN) sem quebrar. */
export function isValidCoordinate(point: { lat?: unknown; lng?: unknown } | null | undefined): point is LatLng {
  if (!point) return false;
  const { lat, lng } = point;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Distância em km (fórmula de haversine); null se algum dos dois pontos faltar ou for inválido. */
export function distanceBetween(
  from: { lat?: unknown; lng?: unknown } | null | undefined,
  to: { lat?: unknown; lng?: unknown } | null | undefined,
): number | null {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) return null;

  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "650 m", "1,2 km", "12 km"; "—" quando a distância ainda não é conhecida. */
export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
