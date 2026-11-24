/** Avatar upload + profile read/write: the Supabase client is injected (like auth-core.ts's createAuthService).
 * Base: plano docs/superpowers/plans/2026-09-28-viacep-mapbox-avatar.md (Task 7), ampliado com os campos
 * do perfil (nome, telefone, CPF, nascimento) que app/account.tsx e contexts/profile-context.tsx usam.
 * Colunas de public.profiles: full_name, cpf, phone, birth_date (date), avatar_url. */

import type { SupabaseClient } from '@supabase/supabase-js';

import { maskCpf, maskPhone } from '@/utils/masks';

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** "{uid}/avatar.{ext}" — every upload for a user overwrites this same path, so there's never more than
 * one file per user to clean up. (A RLS do bucket exige que a primeira pasta seja o id do usuário.) */
export function avatarStoragePath(userId: string, contentType: string): string {
  const ext = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!ext) throw new Error(`Tipo de imagem não suportado: ${contentType}`);
  return `${userId}/avatar.${ext}`;
}

/** Appends (or refreshes) a cache-busting query param, so a new photo doesn't keep showing the old one
 * from the image cache at the same public URL. */
export function withCacheBust(url: string, at: number = Date.now()): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${at}`;
}

/** "1990-05-21" (banco) → "21/05/1990" (app). */
export function dbDateToBr(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** "21/05/1990" (app) → "1990-05-21" (banco); vazio ou inválido vira null. */
export function brDateToDb(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const AVATAR_BUCKET = 'avatars';
const SAVE_FAILED_MESSAGE = 'Não foi possível salvar a foto. Tente novamente.';

export type MyProfile = {
  avatarUrl: string | null;
  fullName: string;
  phone: string;
  cpf: string;
  birthDate: string;
};

const EMPTY_PROFILE: MyProfile = { avatarUrl: null, fullName: '', phone: '', cpf: '', birthDate: '' };

export function createProfileService(client: SupabaseClient, options: { fetchImpl?: typeof fetch } = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function updateAvatar(userId: string, file: { uri: string; contentType: string }): Promise<string> {
    const path = avatarStoragePath(userId, file.contentType);
    const body = await (await fetchImpl(file.uri)).blob();

    const { error: uploadError } = await client.storage
      .from(AVATAR_BUCKET)
      .upload(path, body, { contentType: file.contentType, upsert: true });
    if (uploadError) throw new Error(SAVE_FAILED_MESSAGE);

    const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = withCacheBust(data.publicUrl);

    const { error: updateError } = await client.from('profiles').update({ avatar_url: url }).eq('id', userId);
    if (updateError) throw new Error(SAVE_FAILED_MESSAGE);

    return url;
  }

  /** Never rejects: any failure (row missing, network, malformed data) just means "empty profile"
   * (full_name é NOT NULL no banco, então fullName vazio só significa que a busca falhou). */
  async function getMyProfile(userId: string): Promise<MyProfile> {
    try {
      const { data, error } = await client
        .from('profiles')
        .select('avatar_url, full_name, phone, cpf, birth_date')
        .eq('id', userId)
        .single();
      if (error || !data) return EMPTY_PROFILE;
      return {
        avatarUrl: data.avatar_url ?? null,
        fullName: data.full_name ?? '',
        phone: data.phone ? maskPhone(data.phone) : '',
        cpf: data.cpf ? maskCpf(data.cpf) : '',
        birthDate: dbDateToBr(data.birth_date),
      };
    } catch {
      return EMPTY_PROFILE;
    }
  }

  async function updateProfileFields(
    userId: string,
    fields: { fullName: string; phone: string; cpf: string; birthDate: string },
  ): Promise<void> {
    const { error } = await client
      .from('profiles')
      .update({
        full_name: fields.fullName,
        phone: digitsOnly(fields.phone) || null,
        cpf: digitsOnly(fields.cpf) || null,
        birth_date: brDateToDb(fields.birthDate),
      })
      .eq('id', userId);
    if (error) {
      if (error.code === '23505') throw new Error('Este CPF já está cadastrado em outra conta.');
      throw new Error('Não foi possível salvar seus dados. Tente novamente.');
    }
  }

  return { updateAvatar, getMyProfile, updateProfileFields };
}
