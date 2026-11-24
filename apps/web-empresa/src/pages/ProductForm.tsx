import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ImageInput } from '../components/ImageInput';
import { useUnsavedChanges } from '../components/UnsavedChanges';
import { useToast } from '../components/Toast';
import { finalPriceCents, formatCents, parsePriceToCents } from '../lib/money';
import { validateProduct, type ProductErrors, type ProductForm } from '../lib/product-rules';
import { usePartner } from '../partner/PartnerContext';
import { getProduct, listCategories, saveProduct, type Category, type Product } from '../products/api';

const EMPTY: ProductForm = {
  name: '', categoryId: '', description: '', expiresOn: '', quantity: '', originalPrice: '', discountPercent: '', barcode: '',
};

const toDateInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { partner } = usePartner();
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductForm>(EMPTY);
  const [existing, setExisting] = useState<Product | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [errors, setErrors] = useState<ProductErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [initialForm, setInitialForm] = useState(JSON.stringify(EMPTY));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setFormError('Não foi possível carregar as categorias.'));
  }, []);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((product) => {
        if (!product || product.status === 'removed') return navigate('/produtos', { replace: true });
        setExisting(product);
        const loaded: ProductForm = {
          name: product.name,
          categoryId: product.category_id ?? '',
          description: product.description ?? '',
          expiresOn: toDateInput(product.expires_at),
          quantity: String(product.quantity),
          originalPrice: (product.original_price_cents / 100).toFixed(2).replace('.', ','),
          discountPercent: String(product.discount_percent),
          barcode: product.barcode ?? '',
        };
        setForm(loaded);
        setInitialForm(JSON.stringify(loaded));
      })
      .catch(() => setFormError('Não foi possível carregar o produto.'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const { markClean } = useUnsavedChanges('product-form', !loading && (JSON.stringify(form) !== initialForm || file !== null));

  const set = (key: keyof ProductForm) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const originalCents = parsePriceToCents(form.originalPrice);
  const discount = Number(form.discountPercent);
  const previewOk = originalCents !== null && /^\d+$/.test(form.discountPercent) && discount >= 20 && discount <= 90;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !partner) return;
    const found = validateProduct(form, new Date());
    // Ao editar um produto que já venceu, só exigimos validade futura se a data foi alterada.
    if (existing && form.expiresOn === toDateInput(existing.expires_at)) delete found.expiresOn;
    setErrors(found);
    if (Object.keys(found).length > 0 || imageError) {
      toast.error('Revise os campos destacados.');
      return setFormError('Revise os campos destacados.');
    }

    setFormError('');
    setBusy(true);
    try {
      await saveProduct({
        partnerId: partner.id,
        productId: existing?.id,
        form,
        imageFile: file,
        currentImageUrl: existing?.image_url ?? null,
      });
      toast.success(existing ? 'Produto atualizado com sucesso.' : 'Produto publicado! Ele já aparece no app.');
      markClean();
      navigate('/produtos', { replace: true });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Não foi possível salvar o produto.';
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="muted">Carregando…</p>;

  const text = (key: keyof ProductForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input id={key} value={form[key]} onChange={(e) => set(key)(e.target.value)} aria-invalid={Boolean(errors[key])} {...props} />
      {errors[key] ? <span className="error">{errors[key]}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );

  const today = toDateInput(new Date().toISOString());

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{existing ? 'Editar produto' : 'Novo produto'}</h1>
          <p className="muted">Produtos perto do vencimento, com desconto de 20% a 90%.</p>
        </div>
        <Link className="btn btn-ghost" to="/produtos">
          Voltar
        </Link>
      </div>

      {formError ? <div className="alert alert-error" role="alert">{formError}</div> : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="card">
            {text('name', 'Nome do produto', { maxLength: 120 })}
            <div className="field">
              <label htmlFor="categoryId">Categoria</label>
              <select id="categoryId" value={form.categoryId} onChange={(e) => set('categoryId')(e.target.value)} aria-invalid={Boolean(errors.categoryId)}>
                <option value="">Selecione…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.categoryId ? <span className="error">{errors.categoryId}</span> : null}
            </div>
            <div className="field">
              <label htmlFor="description">Descrição (opcional)</label>
              <textarea id="description" value={form.description} onChange={(e) => set('description')(e.target.value)} aria-invalid={Boolean(errors.description)} />
              {errors.description ? <span className="error">{errors.description}</span> : null}
            </div>
            <div className="row">
              {text('originalPrice', 'Preço original (R$)', { inputMode: 'decimal', placeholder: '0,00' })}
              {text('discountPercent', 'Desconto (%)', { inputMode: 'numeric', placeholder: '20 a 90' })}
            </div>
            {previewOk ? (
              <div className="price-preview">
                Preço final no app: <strong>{formatCents(finalPriceCents(originalCents, discount))}</strong>
              </div>
            ) : null}
            <div className="row">
              {text('quantity', 'Quantidade em estoque', { inputMode: 'numeric' })}
              {text('expiresOn', 'Validade', { type: 'date', min: today })}
            </div>
            {text('barcode', 'Código de barras (opcional)', { inputMode: 'numeric' }, '8 a 14 números.')}
          </div>

          <div>
            <ImageInput currentUrl={existing?.image_url ?? null} file={file} onChange={setFile} error={imageError} onError={setImageError} />
            <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 16 }}>
              {busy ? 'Salvando…' : existing ? 'Salvar alterações' : 'Publicar produto'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
