/**
 * Dados do usuário no Supabase: endereços, favoritos, cartões e avaliações de pedido.
 * O cliente entra por parâmetro (como em auth-core.ts), então nada aqui importa o React Native.
 *
 * ATENÇÃO: RECRIADO a partir do esquema do banco e de como os contextos chamam estes serviços
 * (o arquivo original não veio no pacote). Tabelas: addresses, favorites, payment_methods, order_reviews.
 * Todas têm RLS "só o dono" (user_id / consumer_id = auth.uid()).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Address, AddressInput, AddressTag } from '@/contexts/addresses-context';
import type { CardBrand, CardInput, CardKind } from '@/contexts/payment-methods-context';

/** Mesmas coordenadas de CASCAVEL_CENTER (contexts/addresses-context.tsx): usadas quando o endereço não tem lat/lng. */
const FALLBACK_COORDINATES = { lat: -24.9555, lng: -53.4552 };

type AddressRow = {
  id: string;
  label: string;
  tag: string;
  cep: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
};

const ADDRESS_COLUMNS = 'id, label, tag, cep, street, number, complement, neighborhood, city, lat, lng, is_default';

function toAddress(row: AddressRow): Address {
  const tag: AddressTag = row.tag === 'casa' || row.tag === 'trabalho' ? row.tag : 'outro';
  return {
    id: row.id,
    label: row.label,
    tag,
    cep: row.cep ?? '',
    street: row.street,
    number: row.number ?? '',
    complement: row.complement ?? '',
    neighborhood: row.neighborhood ?? '',
    city: row.city ?? '',
    lat: row.lat ?? FALLBACK_COORDINATES.lat,
    lng: row.lng ?? FALLBACK_COORDINATES.lng,
    isDefault: row.is_default,
  };
}

function addressColumns(input: AddressInput) {
  return {
    label: input.label,
    tag: input.tag,
    cep: input.cep || null,
    street: input.street,
    number: input.number || null,
    complement: input.complement || null,
    neighborhood: input.neighborhood || null,
    city: input.city || null,
    lat: input.lat,
    lng: input.lng,
  };
}

export function createAddressesService(client: SupabaseClient) {
  /** Nunca rejeita: falha de rede devolve lista vazia (a tela de endereços mostra o estado vazio). */
  async function listMyAddresses(userId: string): Promise<Address[]> {
    try {
      const { data, error } = await client
        .from('addresses')
        .select(ADDRESS_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error || !data) return [];
      return (data as AddressRow[]).map(toAddress);
    } catch {
      return [];
    }
  }

  async function createAddress(userId: string, input: AddressInput, isDefault: boolean): Promise<Address> {
    const { data, error } = await client
      .from('addresses')
      .insert({ user_id: userId, ...addressColumns(input), is_default: isDefault })
      .select(ADDRESS_COLUMNS)
      .single();
    if (error || !data) throw new Error('Não foi possível salvar o endereço. Tente novamente.');
    return toAddress(data as AddressRow);
  }

  async function updateAddress(id: string, input: AddressInput): Promise<Address> {
    const { data, error } = await client
      .from('addresses')
      .update({ ...addressColumns(input), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(ADDRESS_COLUMNS)
      .single();
    if (error || !data) throw new Error('Não foi possível salvar o endereço. Tente novamente.');
    return toAddress(data as AddressRow);
  }

  async function deleteAddress(id: string): Promise<void> {
    const { error } = await client.from('addresses').delete().eq('id', id);
    if (error) throw new Error('Não foi possível remover o endereço. Tente novamente.');
  }

  /** Marca este endereço como padrão e desmarca todos os outros do mesmo usuário. */
  async function setDefaultAddress(userId: string, id: string): Promise<void> {
    const { error: clearError } = await client
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .neq('id', id);
    if (clearError) throw new Error('Não foi possível definir o endereço padrão. Tente novamente.');

    const { error } = await client.from('addresses').update({ is_default: true }).eq('id', id);
    if (error) throw new Error('Não foi possível definir o endereço padrão. Tente novamente.');
  }

  return { listMyAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress };
}

export function createFavoritesService(client: SupabaseClient) {
  /** Nunca rejeita: falha devolve lista vazia. (favorites.product_id é texto: o id do produto no app.) */
  async function listMyFavoriteIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await client.from('favorites').select('product_id').eq('user_id', userId);
      if (error || !data) return [];
      return (data as { product_id: string }[]).map((row) => row.product_id);
    } catch {
      return [];
    }
  }

  async function addFavorite(userId: string, productId: string): Promise<void> {
    const { error } = await client
      .from('favorites')
      .upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
    if (error) throw new Error('Não foi possível salvar o favorito. Tente novamente.');
  }

  async function removeFavorite(userId: string, productId: string): Promise<void> {
    const { error } = await client.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
    if (error) throw new Error('Não foi possível remover o favorito. Tente novamente.');
  }

  return { listMyFavoriteIds, addFavorite, removeFavorite };
}

type CardRow = {
  id: string;
  brand: string | null;
  kind: string | null;
  holder_name: string | null;
  last4: string | null;
  expiry: string | null;
};

const CARD_COLUMNS = 'id, brand, kind, holder_name, last4, expiry';

export type StoredCard = { id: string } & CardInput;

function toCard(row: CardRow): StoredCard {
  const brand: CardBrand = row.brand === 'mastercard' ? 'mastercard' : 'visa';
  const kind: CardKind = row.kind === 'debito' ? 'debito' : 'credito';
  return { id: row.id, brand, kind, holderName: row.holder_name ?? '', last4: row.last4 ?? '', expiry: row.expiry ?? '' };
}

export function createPaymentMethodsService(client: SupabaseClient) {
  /** Só cartões: Pix e dinheiro são fixos no app. Nunca rejeita. */
  async function listMyCards(userId: string): Promise<StoredCard[]> {
    try {
      const { data, error } = await client
        .from('payment_methods')
        .select(CARD_COLUMNS)
        .eq('user_id', userId)
        .eq('type', 'cartao')
        .order('created_at', { ascending: true });
      if (error || !data) return [];
      return (data as CardRow[]).map(toCard);
    } catch {
      return [];
    }
  }

  /** Só guarda os 4 últimos dígitos, nunca o número completo nem o CVV. */
  async function addCard(userId: string, input: CardInput): Promise<StoredCard> {
    const { data, error } = await client
      .from('payment_methods')
      .insert({
        user_id: userId,
        type: 'cartao',
        brand: input.brand,
        kind: input.kind,
        holder_name: input.holderName,
        last4: input.last4,
        expiry: input.expiry,
      })
      .select(CARD_COLUMNS)
      .single();
    if (error || !data) throw new Error('Não foi possível salvar o cartão. Tente novamente.');
    return toCard(data as CardRow);
  }

  async function removeCard(id: string): Promise<void> {
    const { error } = await client.from('payment_methods').delete().eq('id', id);
    if (error) throw new Error('Não foi possível remover o cartão. Tente novamente.');
  }

  return { listMyCards, addCard, removeCard };
}

export function createReviewsService(client: SupabaseClient) {
  /** Nota (1–5) de um pedido: cria a avaliação ou atualiza a que o usuário já fez para o mesmo pedido. */
  async function submitOrderReview(args: {
    consumerId: string;
    marketId: string;
    orderCode: string;
    rating: number;
  }): Promise<void> {
    const { consumerId, marketId, orderCode, rating } = args;
    const failed = 'Não foi possível enviar sua avaliação. Tente novamente.';

    const { data: existing, error: findError } = await client
      .from('order_reviews')
      .select('id')
      .eq('consumer_id', consumerId)
      .eq('order_code', orderCode)
      .maybeSingle();
    if (findError) throw new Error(failed);

    if (existing) {
      const { error } = await client
        .from('order_reviews')
        .update({ rating, market_id: marketId, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw new Error(failed);
      return;
    }

    const { error } = await client
      .from('order_reviews')
      .insert({ consumer_id: consumerId, market_id: marketId, order_code: orderCode, rating });
    if (error) throw new Error(failed);
  }

  return { submitOrderReview };
}
