import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { formatCnpj, onlyDigits } from '../lib/cnpj';
import { COMPANY_CATEGORIES, validateCompany, type CompanyForm } from '../lib/company-rules';
import { useToast } from '../components/Toast';
import { useUnsavedChanges } from '../components/UnsavedChanges';
import { supabase } from '../lib/supabase';
import { fetchAddressByCep } from '../lib/viacep';
import { CompanyImagePicker } from '../components/CompanyImagePicker';
import { uploadCompanyImage } from '../partner/media';
import { homePath, usePartner } from '../partner/PartnerContext';

const CATEGORIES = COMPANY_CATEGORIES;

type Form = CompanyForm;

const EMPTY: Form = {
  legalName: '', tradeName: '', cnpj: '', phone: '', email: '', category: '',
  cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
};

export function CompanyForm() {
  const { user } = useAuth();
  const { partner, reload } = usePartner();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<Form>({ ...EMPTY, email: user?.email ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const initialForm = useRef(JSON.stringify({ ...EMPTY, email: user?.email ?? '' }));
  const { markClean } = useUnsavedChanges('company-form', JSON.stringify(form) !== initialForm.current || logoFile !== null || bannerFile !== null);

  if (partner) return <Navigate to={homePath(partner)} replace />;

  const set = (key: keyof Form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleCep = async (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    set('cep')(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
    if (digits.length === 8) {
      const address = await fetchAddressByCep(digits);
      if (address) setForm((current) => ({ ...current, ...address }));
    }
  };

  const validate = () => validateCompany(form);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !user) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Revise os campos destacados.');
      return setFormError('Revise os campos destacados.');
    }

    setFormError('');
    setBusy(true);
    try {
      const { data: created, error } = await supabase
        .from('partners')
        .insert({
        owner_id: user.id,
        legal_name: form.legalName.trim(),
        trade_name: form.tradeName.trim(),
        cnpj: onlyDigits(form.cnpj),
        phone: onlyDigits(form.phone),
        email: form.email.trim(),
        category: form.category,
        cep: onlyDigits(form.cep),
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
      })
        .select('id')
        .single();
      if (error) {
        if (error.code === '23505') return setErrors({ cnpj: 'Este CNPJ já está cadastrado.' });
        if (error.code === '23503') return setFormError('Sua conta ainda não está pronta. Saia, entre de novo e tente outra vez; se persistir, fale com o suporte.');
        toast.error('Não foi possível salvar os dados da empresa. Tente novamente.');
        return setFormError('Não foi possível salvar os dados da empresa. Tente novamente.');
      }
      // Logo e banner são opcionais e sobem depois que o cadastro existe (a pasta de arquivos é o id da empresa).
      // Se algum falhar, o cadastro já está salvo: a pessoa é avisada e envia de novo em "Logo e banner".
      let mediaFailed = false;
      for (const [kind, file] of [['logo', logoFile], ['banner', bannerFile]] as const) {
        if (!file || !created) continue;
        try {
          await uploadCompanyImage({ partnerId: created.id, kind, file });
        } catch {
          mediaFailed = true;
        }
      }
      await reload();
      markClean();
      toast.success('Cadastro enviado! Nossa equipe vai analisar os dados da empresa.');
      if (mediaFailed) toast.error('Não foi possível enviar a logo ou o banner. Envie de novo em Configurações.');
      navigate('/aguardando', { replace: true, state: mediaFailed ? { mediaFailed: true } : undefined });
    } catch {
      setFormError('Não foi possível conectar ao servidor. Verifique sua internet.');
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input id={key} value={form[key]} onChange={(e) => set(key)(e.target.value)} aria-invalid={Boolean(errors[key])} {...props} />
      {errors[key] ? <span className="error">{errors[key]}</span> : null}
    </div>
  );

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <h1>Dados da empresa</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Depois de enviados, nossa equipe aprova o cadastro e você já pode publicar produtos.
      </p>
      {formError ? <div className="alert alert-error" role="alert">{formError}</div> : null}
      <form onSubmit={handleSubmit} noValidate>
        <div className="row">
          {field('legalName', 'Razão social')}
          {field('tradeName', 'Nome fantasia')}
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="cnpj">CNPJ</label>
            <input id="cnpj" value={form.cnpj} inputMode="numeric" placeholder="00.000.000/0000-00" onChange={(e) => set('cnpj')(formatCnpj(e.target.value))} aria-invalid={Boolean(errors.cnpj)} />
            {errors.cnpj ? <span className="error">{errors.cnpj}</span> : null}
          </div>
          {field('phone', 'Telefone com DDD', { inputMode: 'tel' })}
        </div>
        <div className="row">
          {field('email', 'E-mail de contato', { type: 'email' })}
          <div className="field">
            <label htmlFor="category">Categoria do estabelecimento</label>
            <select id="category" value={form.category} onChange={(e) => set('category')(e.target.value)} aria-invalid={Boolean(errors.category)}>
              <option value="">Selecione…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category ? <span className="error">{errors.category}</span> : null}
          </div>
        </div>

        <h2 style={{ margin: '8px 0 12px' }}>Endereço</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="cep">CEP</label>
            <input id="cep" value={form.cep} inputMode="numeric" placeholder="00000-000" onChange={(e) => handleCep(e.target.value)} aria-invalid={Boolean(errors.cep)} />
            {errors.cep ? <span className="error">{errors.cep}</span> : <span className="hint">Preenchemos o endereço pelo CEP.</span>}
          </div>
          {field('street', 'Rua')}
        </div>
        <div className="row">
          {field('number', 'Número')}
          {field('complement', 'Complemento (opcional)')}
          {field('neighborhood', 'Bairro')}
        </div>
        <div className="row">
          {field('city', 'Cidade')}
          {field('state', 'UF', { maxLength: 2 })}
        </div>

        <h2 style={{ margin: '8px 0 12px' }}>Identidade da empresa</h2>
        <CompanyImagePicker kind="logo" label="Logo" file={logoFile} onChange={setLogoFile} />
        <CompanyImagePicker kind="banner" label="Banner" file={bannerFile} onChange={setBannerFile} />

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar cadastro'}
        </button>
      </form>
    </div>
  );
}
