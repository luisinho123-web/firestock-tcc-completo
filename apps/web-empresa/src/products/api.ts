import { parsePriceToCents } from '../lib/money';
import { expiryToIso, type ProductForm, type ProductStatus } from '../lib/product-rules';
import { supabase } from '../lib/supabase';

export type Category = { id: string; slug: string; name: string };

export type Product = {
  id: string;
  partner_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  barcode: string | null;
  original_price_cents: number;
  discount_percent: number;
  price_cents: number | null;
  quantity: number;
  expires_at: string;
  status: ProductStatus;
  created_at: string;
};

export const PRODUCT_IMAGE_BUCKET = 'product-images';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const SAVE_ERROR = 'Não foi possível salvar o produto. Tente novamente.';

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('id, slug, name').order('name');
  if (error) throw new Error('Não foi possível carregar as categorias.');
  return data as Category[];
}

/** Produtos da empresa, sem os removidos. */
export async function listProducts(partnerId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('partner_id', partnerId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Não foi possível carregar os produtos.');
  return data as Product[];
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Não foi possível carregar o produto.');
  return (data as Product | null) ?? null;
}

/** Caminho do objeto no bucket, a partir da URL pública (para apagar a foto antiga). */
function storagePathFromUrl(url: string | null): string | null {
  const marker = `/${PRODUCT_IMAGE_BUCKET}/`;
  const index = url?.indexOf(marker) ?? -1;
  return url && index >= 0 ? decodeURIComponent(url.slice(index + marker.length).split('?')[0]) : null;
}

/**
 * Cria ou atualiza o produto. A foto sobe ANTES de a linha ser gravada; se a gravação falhar, a foto recém-enviada é
 * apagada, para nunca sobrar arquivo órfão nem produto apontando para uma foto que não existe.
 */
export async function saveProduct(args: {
  partnerId: string;
  productId?: string;
  form: ProductForm;
  imageFile?: File | null;
  currentImageUrl?: string | null;
}): Promise<void> {
  const { partnerId, productId, form, imageFile, currentImageUrl = null } = args;

  let imageUrl = currentImageUrl;
  let uploadedPath: string | null = null;

  if (imageFile) {
    const extension = IMAGE_TYPES[imageFile.type];
    if (!extension || imageFile.size > MAX_IMAGE_BYTES) throw new Error('A foto precisa ser JPEG, PNG ou WebP de até 2 MB.');
    uploadedPath = `${partnerId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(uploadedPath, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) throw new Error('Não foi possível enviar a foto. Tente novamente.');
    imageUrl = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
  }

  const row = {
    name: form.name.trim(),
    category_id: form.categoryId,
    description: form.description.trim() || null,
    barcode: form.barcode.trim() || null,
    original_price_cents: parsePriceToCents(form.originalPrice),
    discount_percent: Number(form.discountPercent),
    quantity: Number(form.quantity),
    expires_at: expiryToIso(form.expiresOn),
    image_url: imageUrl,
  };

  const { error } = productId
    ? await supabase.from('products').update(row).eq('id', productId)
    : await supabase.from('products').insert({ ...row, partner_id: partnerId });

  if (error) {
    if (uploadedPath) await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([uploadedPath]);
    throw new Error(error.message.includes('validade') ? 'A validade precisa ser uma data futura.' : SAVE_ERROR);
  }

  if (uploadedPath) {
    const oldPath = storagePathFromUrl(currentImageUrl);
    if (oldPath) await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([oldPath]);
  }
}

/** Remover = exclusão lógica: o registro fica, mas sai do app e da lista. */
export async function removeProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').update({ status: 'removed' }).eq('id', id);
  if (error) throw new Error('Não foi possível remover o produto. Tente novamente.');
}
