export type ImageKind = 'logo' | 'banner';

const MB = 1024 * 1024;

export const IMAGE_LIMITS: Record<ImageKind, { maxBytes: number; maxLabel: string; name: string; hint: string }> = {
  logo: { maxBytes: 2 * MB, maxLabel: '2 MB', name: 'logo', hint: 'Quadrada, de preferência 512 × 512 px.' },
  banner: { maxBytes: 3 * MB, maxLabel: '3 MB', name: 'banner', hint: 'Larga, de preferência 1200 × 400 px (proporção 3:1).' },
};

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const ACCEPTED_TYPES = Object.keys(EXTENSIONS).join(',');

export function extensionFor(type: string): string | null {
  return EXTENSIONS[type] ?? null;
}

/** Confere tipo e tamanho ANTES de qualquer envio. Devolve a mensagem de erro, ou '' quando está tudo certo. */
export function validateImageFile(file: { type: string; size: number }, kind: ImageKind): string {
  const limit = IMAGE_LIMITS[kind];
  if (!extensionFor(file.type)) return `O ${limit.name} precisa ser uma imagem JPEG, PNG ou WebP.`;
  if (file.size <= 0) return `O arquivo do ${limit.name} está vazio.`;
  if (file.size > limit.maxBytes) return `O ${limit.name} precisa ter no máximo ${limit.maxLabel}.`;
  return '';
}

/** Caminho do objeto dentro do bucket, a partir da URL pública (para apagar o arquivo antigo). */
export function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const index = url ? url.indexOf(marker) : -1;
  if (!url || index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}
