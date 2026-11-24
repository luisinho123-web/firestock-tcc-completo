import { parsePriceToCents } from './money';

export type ProductForm = {
  name: string;
  categoryId: string;
  description: string;
  /** yyyy-mm-dd, como vem do campo de data. */
  expiresOn: string;
  quantity: string;
  originalPrice: string;
  discountPercent: string;
  barcode: string;
};

export type ProductErrors = Partial<Record<keyof ProductForm, string>>;

export type ProductStatus = 'active' | 'expired' | 'removed';
export type ProductState = 'active' | 'soldout' | 'expired' | 'removed';

/** RN010: medicamentos e suplementos não são permitidos no MVP. */
export const BLOCKED_TERMS = ['medicamento', 'remedio', 'suplemento', 'whey', 'creatina', 'anticoncepcional'];

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const hasBlockedTerm = (text: string) => BLOCKED_TERMS.some((term) => normalize(text).includes(term));

/** A validade vale até o fim do dia escolhido, no horário local. */
export function expiryToIso(expiresOn: string): string {
  const [year, month, day] = expiresOn.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

export function validateProduct(form: ProductForm, now: Date): ProductErrors {
  const errors: ProductErrors = {};

  if (!form.name.trim()) errors.name = 'Informe o nome do produto.';
  else if (hasBlockedTerm(form.name)) errors.name = 'Medicamentos e suplementos não são permitidos.';

  if (!form.categoryId) errors.categoryId = 'Escolha uma categoria.';

  if (hasBlockedTerm(form.description)) errors.description = 'Medicamentos e suplementos não são permitidos.';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.expiresOn)) errors.expiresOn = 'Informe a data de validade.';
  else if (new Date(expiryToIso(form.expiresOn)) <= now) errors.expiresOn = 'A validade precisa ser uma data futura.';

  if (!/^\d+$/.test(form.quantity.trim())) errors.quantity = 'Informe a quantidade com número inteiro (0 ou mais).';

  if (parsePriceToCents(form.originalPrice) === null) errors.originalPrice = 'Informe um preço original maior que zero.';

  const discount = form.discountPercent.trim();
  if (!/^\d+$/.test(discount) || Number(discount) < 20 || Number(discount) > 90) {
    errors.discountPercent = 'O desconto precisa ser um número inteiro entre 20% e 90%.';
  }

  if (form.barcode.trim() && !/^\d{8,14}$/.test(form.barcode.trim())) {
    errors.barcode = 'O código de barras deve ter de 8 a 14 números.';
  }

  return errors;
}

export function productState(
  product: { status: ProductStatus; quantity: number; expires_at: string },
  now: Date,
): ProductState {
  if (product.status === 'removed') return 'removed';
  if (product.status === 'expired' || new Date(product.expires_at) <= now) return 'expired';
  if (product.quantity === 0) return 'soldout';
  return 'active';
}
