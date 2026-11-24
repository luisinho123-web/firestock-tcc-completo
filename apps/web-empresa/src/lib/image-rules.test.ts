import { describe, expect, it } from 'vitest';

import { extensionFor, IMAGE_LIMITS, storagePathFromPublicUrl, validateImageFile } from './image-rules';

const MB = 1024 * 1024;

describe('validateImageFile', () => {
  it('aceita JPEG, PNG e WebP dentro do limite de cada tipo de imagem', () => {
    expect(validateImageFile({ type: 'image/png', size: 1 * MB }, 'logo')).toBe('');
    expect(validateImageFile({ type: 'image/jpeg', size: 3 * MB }, 'banner')).toBe('');
    expect(validateImageFile({ type: 'image/webp', size: 100 }, 'logo')).toBe('');
  });

  it('recusa tipo que não é imagem aceita (SVG, GIF, PDF) com mensagem clara', () => {
    expect(validateImageFile({ type: 'image/svg+xml', size: 1000 }, 'logo')).toContain('JPEG, PNG ou WebP');
    expect(validateImageFile({ type: 'image/gif', size: 1000 }, 'banner')).toContain('JPEG, PNG ou WebP');
    expect(validateImageFile({ type: 'application/pdf', size: 1000 }, 'logo')).toContain('JPEG, PNG ou WebP');
    expect(validateImageFile({ type: '', size: 1000 }, 'logo')).toContain('JPEG, PNG ou WebP');
  });

  it('recusa arquivo acima do limite: logo 2 MB, banner 3 MB', () => {
    expect(IMAGE_LIMITS.logo.maxBytes).toBe(2 * MB);
    expect(IMAGE_LIMITS.banner.maxBytes).toBe(3 * MB);
    expect(validateImageFile({ type: 'image/png', size: 2 * MB + 1 }, 'logo')).toContain('2 MB');
    expect(validateImageFile({ type: 'image/png', size: 3 * MB + 1 }, 'banner')).toContain('3 MB');
    expect(validateImageFile({ type: 'image/png', size: 2 * MB + 1 }, 'banner')).toBe('');
  });

  it('recusa arquivo vazio', () => {
    expect(validateImageFile({ type: 'image/png', size: 0 }, 'logo')).not.toBe('');
  });
});

describe('extensionFor', () => {
  it('mapeia o tipo para a extensão', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
    expect(extensionFor('image/gif')).toBeNull();
  });
});

describe('storagePathFromPublicUrl', () => {
  const url = 'https://x.supabase.co/storage/v1/object/public/company-media/abc/logo-123.png?v=1';
  it('extrai o caminho dentro do bucket', () => {
    expect(storagePathFromPublicUrl(url, 'company-media')).toBe('abc/logo-123.png');
  });
  it('devolve null para URL de outro bucket, vazia ou nula', () => {
    expect(storagePathFromPublicUrl(url, 'avatars')).toBeNull();
    expect(storagePathFromPublicUrl('', 'company-media')).toBeNull();
    expect(storagePathFromPublicUrl(null, 'company-media')).toBeNull();
  });
});
