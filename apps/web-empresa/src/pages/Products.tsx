import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { formatCents } from '../lib/money';
import { productState, type ProductState } from '../lib/product-rules';
import { usePartner } from '../partner/PartnerContext';
import { listCategories, listProducts, removeProduct, type Category, type Product } from '../products/api';

const STATE_LABEL: Record<ProductState, string> = { active: 'Ativo', soldout: 'Esgotado', expired: 'Vencido', removed: 'Removido' };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export function Products() {
  const { partner } = usePartner();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [toRemove, setToRemove] = useState<Product | null>(null);
  const [removing, setRemoving] = useState(false);

  const partnerId = partner?.id;

  const load = async () => {
    if (!partnerId) return;
    try {
      const [list, cats] = await Promise.all([listProducts(partnerId), listCategories()]);
      setProducts(list);
      setCategories(cats);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  const now = new Date();
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Sem categoria';

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (categoryFilter && p.category_id !== categoryFilter) return false;
      if (stateFilter && productState(p, new Date()) !== stateFilter) return false;
      return true;
    });
  }, [products, search, categoryFilter, stateFilter]);

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await removeProduct(toRemove.id);
      setProducts((current) => current.filter((p) => p.id !== toRemove.id));
      toast.success(`"${toRemove.name}" foi removido.`);
      setToRemove(null);
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : 'Não foi possível remover o produto.';
      setError(message);
      toast.error(message);
      setToRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Produtos</h1>
          <p className="muted">Anúncios de produtos perto do vencimento que aparecem no app.</p>
        </div>
        <Link className="btn btn-primary" to="/produtos/novo">
          Novo produto
        </Link>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      {products.length > 0 ? (
        <div className="filters">
          <div className="field">
            <input placeholder="Buscar pelo nome" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar produto" />
          </div>
          <div className="field">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar por categoria">
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} aria-label="Filtrar por estado">
              <option value="">Todos os estados</option>
              <option value="active">Ativos</option>
              <option value="soldout">Esgotados</option>
              <option value="expired">Vencidos</option>
            </select>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="muted">Carregando…</p>
      ) : products.length === 0 ? (
        <div className="card empty">
          <h2>Você ainda não cadastrou produtos</h2>
          <p className="muted">Cadastre o primeiro produto perto do vencimento para ele aparecer no app.</p>
          <Link className="btn btn-primary" to="/produtos/novo">
            Cadastrar primeiro produto
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <p className="muted">Nenhum produto encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="product-list">
          {visible.map((product) => {
            const state = productState(product, now);
            return (
              <div className="product-item" key={product.id}>
                {product.image_url ? <img className="product-thumb" src={product.image_url} alt="" /> : <div className="product-thumb">Sem foto</div>}
                <div>
                  <div className="product-name">{product.name}</div>
                  <div className="product-meta">
                    {categoryName(product.category_id)} · vence em {formatDate(product.expires_at)} · {product.quantity} un.
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className="price">{formatCents(product.price_cents ?? product.original_price_cents)}</span>
                    <span className="price-old">{formatCents(product.original_price_cents)}</span>{' '}
                    <span className="badge badge-discount">-{product.discount_percent}%</span>{' '}
                    <span className={`badge badge-${state}`}>{STATE_LABEL[state]}</span>
                  </div>
                </div>
                <div className="actions">
                  <Link className="btn btn-ghost btn-sm" to={`/produtos/${product.id}`}>
                    Editar
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => setToRemove(product)}>
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toRemove ? (
        <ConfirmDialog
          title="Remover produto?"
          message={`"${toRemove.name}" deixa de aparecer no app. Essa ação não pode ser desfeita aqui.`}
          confirmLabel="Remover"
          busy={removing}
          onConfirm={confirmRemove}
          onCancel={() => setToRemove(null)}
        />
      ) : null}
    </>
  );
}
