/**
 * Catálogo real: empresas aprovadas e produtos ativos que as empresas cadastram no web-empresa.
 * Troca o conteúdo de PARTNERS e PRODUCTS (arrays de módulo) pelo que veio do Supabase.
 *
 * ATENÇÃO: RECRIADO a partir do esquema do banco, das regras de acesso (RLS) e dos tipos em
 * data/partners.ts e data/products.ts (o arquivo original não veio no pacote).
 *   partners: status 'approved' é público; products: status 'active' e expires_at no futuro.
 */

import type { ImageSourcePropType } from 'react-native';

import { registerRemotePartners, setPartnerCoordinates, type Partner } from '@/data/partners';
import { registerRemoteProducts, type Product, type ProductCategory } from '@/data/products';
import { normalizeSearch } from '@/utils/format';

import { geocodeAddress } from './mapbox';
import { supabase } from './supabase';

// Mesmo ponto padrão de CASCAVEL_CENTER: só aparece até a empresa ter coordenadas confiáveis.
const DEFAULT_POINT = { lat: -24.9555, lng: -53.4552 };

const PLACEHOLDER_IMAGE: ImageSourcePropType = require('../assets/images/splash-logo.png');

type PartnerRow = {
  id: string;
  trade_name: string;
  category: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  rating_avg: number | null;
  logo_url: string | null;
  banner_url: string | null;
};

type ProductRow = {
  id: string;
  partner_id: string;
  category_id: string | null;
  name: string;
  image_url: string | null;
  original_price_cents: number;
  discount_percent: number;
  price_cents: number | null;
  quantity: number;
  expires_at: string;
};

const KNOWN_CATEGORIES: Record<string, ProductCategory> = {
  frutas: 'Frutas',
  verduras: 'Verduras',
  legumes: 'Legumes',
  bebidas: 'Bebidas',
};

/** Coordenadas descobertas por geocodificação, para não consultar o Mapbox de novo a cada atualização. */
const discoveredCoordinates = new Map<string, { lat: number; lng: number }>();
const geocodeAttempted = new Set<string>();
const MAX_GEOCODES_PER_REFRESH = 5;

function addressOf(row: PartnerRow): string {
  const street = [row.street, row.number].filter(Boolean).join(', ');
  const place = [row.neighborhood, row.city].filter(Boolean).join(' - ');
  return [street, place].filter(Boolean).join(' · ');
}

function toPartner(row: PartnerRow): Partner {
  const hasCoordinates = row.lat != null && row.lng != null;
  const category = row.category?.trim() || 'Mercado';
  return {
    id: row.id,
    name: row.trade_name,
    kind: /restaurante/i.test(category) ? 'restaurante' : 'mercado',
    category,
    address: addressOf(row),
    description: '',
    image: row.logo_url ? { uri: row.logo_url } : PLACEHOLDER_IMAGE,
    banner: row.banner_url ? { uri: row.banner_url } : undefined,
    rating: row.rating_avg ?? 0,
    remote: true,
    distanceKm: null,
    coordinatesKnown: hasCoordinates,
    // O banco não guarda dados de entrega: valores neutros até existir essa informação.
    deliveryMinMinutes: 20,
    deliveryMaxMinutes: 40,
    deliveryFee: 0,
    freeDeliveryMinOrder: 0,
    featured: false,
    lat: row.lat ?? DEFAULT_POINT.lat,
    lng: row.lng ?? DEFAULT_POINT.lng,
  };
}

function toProduct(row: ProductRow, categoryName: string | undefined): Product {
  const finalCents = row.price_cents ?? Math.round((row.original_price_cents * (100 - row.discount_percent)) / 100);
  return {
    id: row.id,
    title: row.name,
    category: (categoryName && KNOWN_CATEGORIES[normalizeSearch(categoryName)]) || 'Outros',
    price: finalCents / 100,
    unit: 'un',
    image: row.image_url ? { uri: row.image_url } : PLACEHOLDER_IMAGE,
    marketId: row.partner_id,
    originalPrice: row.original_price_cents / 100,
    discountPercent: row.discount_percent,
    expiresAt: row.expires_at,
    stock: row.quantity,
    remote: true,
  };
}

/**
 * Busca de novo as empresas aprovadas e os produtos ativos. Nunca rejeita: se a rede falhar, o catálogo
 * que já estava na tela continua como estava.
 */
export async function refreshCatalog(): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const [partnersResult, productsResult, categoriesResult] = await Promise.all([
      supabase
        .from('partners')
        .select('id, trade_name, category, street, number, neighborhood, city, state, lat, lng, rating_avg, logo_url, banner_url')
        .eq('status', 'approved'),
      supabase
        .from('products')
        .select('id, partner_id, category_id, name, image_url, original_price_cents, discount_percent, price_cents, quantity, expires_at')
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name'),
    ]);

    if (partnersResult.error || productsResult.error || !partnersResult.data || !productsResult.data) return;

    const categoryNames = new Map<string, string>(
      ((categoriesResult.data as { id: string; name: string }[] | null) ?? []).map((category) => [category.id, category.name]),
    );

    const partnerRows = partnersResult.data as PartnerRow[];
    const approvedIds = new Set(partnerRows.map((row) => row.id));

    const partners = partnerRows.map(toPartner);
    const products = (productsResult.data as ProductRow[])
      .filter((row) => approvedIds.has(row.partner_id))
      .map((row) => toProduct(row, row.category_id ? categoryNames.get(row.category_id) : undefined));

    registerRemotePartners(partners);
    registerRemoteProducts(products);

    // Empresas sem coordenadas: aplica as já descobertas e tenta geocodificar algumas novas (melhor esforço).
    let geocodes = 0;
    for (const row of partnerRows) {
      if (row.lat != null && row.lng != null) continue;
      const known = discoveredCoordinates.get(row.id);
      if (known) {
        setPartnerCoordinates(row.id, known);
        continue;
      }
      if (geocodeAttempted.has(row.id) || geocodes >= MAX_GEOCODES_PER_REFRESH) continue;
      const query = addressOf(row).replace(' · ', ', ');
      if (!query) continue;
      geocodeAttempted.add(row.id);
      geocodes += 1;
      const coordinates = await geocodeAddress(query);
      if (coordinates) {
        discoveredCoordinates.set(row.id, coordinates);
        setPartnerCoordinates(row.id, coordinates);
      }
    }
  } catch {
    // Sem rede ou resposta inesperada: mantém o catálogo atual.
  }
}
