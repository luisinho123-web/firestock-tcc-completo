import { extensionFor, storagePathFromPublicUrl, validateImageFile, type ImageKind } from '../lib/image-rules';
import { supabase } from '../lib/supabase';

export const COMPANY_MEDIA_BUCKET = 'company-media';

const COLUMN: Record<ImageKind, 'logo_url' | 'banner_url'> = { logo: 'logo_url', banner: 'banner_url' };

/**
 * Envia a logo ou o banner da empresa e grava a URL no cadastro. O arquivo novo sobe ANTES de a linha ser atualizada
 * (com nome único, para o navegador não mostrar a imagem antiga em cache); se a atualização falhar, o arquivo novo é
 * apagado; se der certo, o arquivo anterior é apagado. Devolve a URL pública nova.
 */
export async function uploadCompanyImage(args: {
  partnerId: string;
  kind: ImageKind;
  file: File;
  currentUrl?: string | null;
}): Promise<string> {
  const { partnerId, kind, file, currentUrl = null } = args;
  const problem = validateImageFile(file, kind);
  if (problem) throw new Error(problem);

  const path = `${partnerId}/${kind}-${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const { error: uploadError } = await supabase.storage.from(COMPANY_MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error('Não foi possível enviar a imagem. Tente novamente.');

  const url = supabase.storage.from(COMPANY_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: updateError } = await supabase.from('partners').update({ [COLUMN[kind]]: url }).eq('id', partnerId);
  if (updateError) {
    await supabase.storage.from(COMPANY_MEDIA_BUCKET).remove([path]);
    throw new Error('Não foi possível salvar a imagem. Tente novamente.');
  }

  const oldPath = storagePathFromPublicUrl(currentUrl, COMPANY_MEDIA_BUCKET);
  if (oldPath) await supabase.storage.from(COMPANY_MEDIA_BUCKET).remove([oldPath]);
  return url;
}

/** Remove a logo ou o banner (limpa a URL e apaga o arquivo). */
export async function removeCompanyImage(args: { partnerId: string; kind: ImageKind; currentUrl: string | null }): Promise<void> {
  const { partnerId, kind, currentUrl } = args;
  const { error } = await supabase.from('partners').update({ [COLUMN[kind]]: null }).eq('id', partnerId);
  if (error) throw new Error('Não foi possível remover a imagem. Tente novamente.');
  const oldPath = storagePathFromPublicUrl(currentUrl, COMPANY_MEDIA_BUCKET);
  if (oldPath) await supabase.storage.from(COMPANY_MEDIA_BUCKET).remove([oldPath]);
}
