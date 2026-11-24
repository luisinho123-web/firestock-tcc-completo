import type { ImageSourcePropType } from 'react-native';

export type ProductCategory = 'Frutas' | 'Verduras' | 'Legumes' | 'Bebidas';

export type Product = {
  id: string;
  title: string;
  /** Produtos cadastrados pelas empresas fora destas quatro categorias entram como 'Outros' (só aparecem em "Todas"). */
  category: ProductCategory | 'Outros';
  /** Preço final, já com desconto. */
  price: number;
  unit: string;
  image: ImageSourcePropType;
  marketId: string;
  /** Só nos produtos reais (cadastrados na web-empresa): preço antes do desconto, desconto, validade e estoque. */
  originalPrice?: number;
  discountPercent?: number;
  expiresAt?: string;
  stock?: number;
  remote?: boolean;
};

/** Começa vazio: o app mostra só o que as empresas aprovadas cadastraram (registerRemote* preenche depois do login). */
export const PRODUCTS: Product[] = [];

let productsById = new Map(PRODUCTS.map((product) => [product.id, product]));

export function getProduct(id: string | undefined): Product | undefined {
  return id ? productsById.get(id) : undefined;
}

/** Troca os produtos pelos cadastrados na web-empresa. O array PRODUCTS é o mesmo objeto, então
 * quem já o importou enxerga a mudança na próxima renderização. */
export function registerRemoteProducts(remote: Product[]) {
  PRODUCTS.splice(0, PRODUCTS.length, ...remote);
  productsById = new Map(PRODUCTS.map((product) => [product.id, product]));
}
