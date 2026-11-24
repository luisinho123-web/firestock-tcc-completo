import type { ImageSourcePropType } from 'react-native';

import { distanceBetween, type LatLng } from '../services/distance-core';

export type PartnerKind = 'mercado' | 'restaurante';

export type Partner = {
  id: string;
  name: string;
  kind: PartnerKind;
  category: string;
  address: string;
  description: string;
  image: ImageSourcePropType;
  /** Banner da empresa (só nas reais): topo da página do mercado. */
  banner?: ImageSourcePropType;
  rating: number;
  /** Empresas reais (da web-empresa), com o id do banco. */
  remote?: boolean;
  /** Distância até o usuário, atualizada com a localização dele. null enquanto falta a localização de um dos dois. */
  distanceKm: number | null;
  /** false quando a empresa ainda não tem coordenadas confiáveis (lat/lng abaixo são só um ponto padrão). */
  coordinatesKnown?: boolean;
  deliveryMinMinutes: number;
  deliveryMaxMinutes: number;
  /** 0 means free delivery. */
  deliveryFee: number;
  freeDeliveryMinOrder: number;
  featured: boolean;
  /** Real-world coordinates (Cascavel - PR) used to place this store on the order-tracking map. */
  lat: number;
  lng: number;
};

/** Começa vazio: o app mostra só o que as empresas aprovadas cadastraram (registerRemote* preenche depois do login). */
export const PARTNERS: Partner[] = [];

let partnersById = new Map(PARTNERS.map((partner) => [partner.id, partner]));

export function getPartner(id: string | undefined): Partner | undefined {
  return id ? partnersById.get(id) : undefined;
}

/** Troca as empresas pelas aprovadas no banco (mesmo array PARTNERS, alterado no lugar). */
export function registerRemotePartners(remote: Partner[]) {
  PARTNERS.splice(0, PARTNERS.length, ...remote);
  partnersById = new Map(PARTNERS.map((partner) => [partner.id, partner]));
  recomputeDistances();
}

let userLocation: LatLng | null = null;

/** Recalcula a distância de cada empresa até a localização atual do usuário (os objetos são alterados no lugar). */
export function recomputeDistances() {
  for (const partner of PARTNERS) {
    partner.distanceKm = partner.coordinatesKnown === false ? null : distanceBetween(userLocation, partner);
  }
}

/** Localização atual do usuário (GPS ou, na falta dele, o endereço padrão). null apaga a localização. */
export function setUserLocation(location: LatLng | null) {
  userLocation = location;
  recomputeDistances();
}

/** Guarda as coordenadas descobertas (geocodificação) de uma empresa que veio do banco sem elas. */
export function setPartnerCoordinates(id: string, coordinates: LatLng) {
  const partner = partnersById.get(id);
  if (!partner) return;
  partner.lat = coordinates.lat;
  partner.lng = coordinates.lng;
  partner.coordinatesKnown = true;
  recomputeDistances();
}

/** Standard delivery fee for an order at this partner: free when the partner never charges or the subtotal reaches its free-delivery minimum. */
export function deliveryFeeFor(partner: Partner, subtotal: number): number {
  return partner.deliveryFee === 0 || subtotal >= partner.freeDeliveryMinOrder ? 0 : partner.deliveryFee;
}
