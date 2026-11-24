import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';

import { useToast } from '../components/Toast';
import { useUnsavedChanges } from '../components/UnsavedChanges';
import { formatCnpj, onlyDigits } from '../lib/cnpj';
import { COMPANY_CATEGORIES, validateCompany, type CompanyErrors, type CompanyForm } from '../lib/company-rules';
import { supabase } from '../lib/supabase';
import { fetchAddressByCep } from '../lib/viacep';
import { usePartner } from '../partner/PartnerContext';
import { IdentitySection } from './CompanyIdentity';
import { PasswordSection } from './PasswordSection';

type PartnerRow = {
  legal_name: string; trade_name: string; cnpj: string; phone: string | null; email: string | null; category: string | null;
  cep: string | null; street: string | null; number: string | null; complement: string | null; neighborhood: string | null;
  city: string | null; state: string | null;
};

const toForm = (row: PartnerRow): CompanyForm => ({
  legalName: row.legal_name, tradeName: row.trade_name, cnpj: formatCnpj(row.cnpj), phone: row.phone ?? '', email: row.email ?? '',
  category: row.category ?? '', cep: row.cep ? `${row.cep.slice(0, 5)}-${row.cep.slice(5)}` : '', street: row.street ?? '',
  number: row.number ?? '', complement: row.complement ?? '', neighborhood: row.neighborhood ?? '', city: row.city ?? '', state: row.state ?? '',
});

/** Configurações da empresa: logo e banner e os dados cadastrais que a empresa pode atualizar. */
export function Settings() {
  const { partner, reload } = usePartner();
  const [form, setForm] = useState<CompanyForm | null>(null);
  const [errors, setErrors] = useState<CompanyErrors>({});
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [initial, setInitial] = useState<string | null>(null);

  const locked = partner?.status === 'approved';
  const partnerId = partner?.id;

  useEffect(() => {
    if (!partnerId) return;
    supabase
      .from('partners')
      .select('legal_name, trade_name, cnpj, phone, email, category, cep, street, number, complement, neighborhood, city, state')
      .eq('id', partnerId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return toast.error('Não foi possível carregar os dados da empresa.');
        const loaded = toForm(data as PartnerRow);
        setForm(loaded);
        setInitial(JSON.stringify(loaded));
      });
  }, [partnerId]);

  useUnsavedChanges('settings-data', form !== null && initial !== null && JSON.stringify(form) !== initial);

  if (!partner) return null;

  const set = (key: keyof CompanyForm) => (value: string) => setForm((current) => (current ? { ...current, [key]: value } : current));

  const handleCep = async (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    set('cep')(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
    if (digits.length === 8) {
      const address = await fetchAddressByCep(digits);
      if (address) setForm((current) => (current ? { ...current, ...address } : current));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !form) return;
    const found = validateCompany(form, { identityLocked: locked });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Revise os campos destacados.');
      return;
    }

    setBusy(true);
    const changes = {
      // Razão social e CNPJ só mudam enquanto a empresa não foi aprovada; depois disso, só o administrador altera.
      ...(locked ? {} : { legal_name: form.legalName.trim(), cnpj: onlyDigits(form.cnpj) }),
      trade_name: form.tradeName.trim(),
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
    };
    try {
      const { error } = await supabase.from('partners').update(changes).eq('id', partner.id);
      if (error) {
        if (error.code === '23505') {
          setErrors({ cnpj: 'Este CNPJ já está cadastrado.' });
          return toast.error('Este CNPJ já está cadastrado.');
        }
        return toast.error('Não foi possível salvar as alterações. Tente novamente.');
      }
      await reload();
      setInitial(JSON.stringify(form));
      toast.success('Dados da empresa atualizados com sucesso.');
    } catch {
      toast.error('Não foi possível conectar ao servidor. Verifique sua internet.');
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof CompanyForm, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) =>
    form ? (
      <div className="field">
        <label htmlFor={`cfg-${key}`}>{label}</label>
        <input id={`cfg-${key}`} value={form[key]} onChange={(e) => set(key)(e.target.value)} aria-invalid={Boolean(errors[key])} {...props} />
        {errors[key] ? <span className="error">{errors[key]}</span> : null}
      </div>
    ) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Atualize o perfil da sua empresa: logo, banner, dados de contato, endereço e a senha de acesso.</p>
        </div>
      </div>

      <div className="settings">
        <IdentitySection />

        <div className="card">
          <h2 className="card-title">Dados da empresa</h2>
          {!form ? (
            <p className="muted">Carregando…</p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="row">
                {field('legalName', 'Razão social', { disabled: locked })}
                <div className="field">
                  <label htmlFor="cfg-cnpj">CNPJ</label>
                  <input id="cfg-cnpj" value={form.cnpj} disabled={locked} inputMode="numeric" onChange={(e) => set('cnpj')(formatCnpj(e.target.value))} aria-invalid={Boolean(errors.cnpj)} />
                  {errors.cnpj ? <span className="error">{errors.cnpj}</span> : null}
                </div>
              </div>
              {locked ? (
                <p className="hint hint-block">Razão social e CNPJ foram aprovados com o cadastro. Para alterar, fale com o suporte do FireStock.</p>
              ) : null}
              <div className="row">
                {field('tradeName', 'Nome fantasia')}
                {field('phone', 'Telefone com DDD', { inputMode: 'tel' })}
              </div>
              <div className="row">
                {field('email', 'E-mail de contato', { type: 'email' })}
                <div className="field">
                  <label htmlFor="cfg-category">Categoria do estabelecimento</label>
                  <select id="cfg-category" value={form.category} onChange={(e) => set('category')(e.target.value)} aria-invalid={Boolean(errors.category)}>
                    <option value="">Selecione…</option>
                    {COMPANY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.category ? <span className="error">{errors.category}</span> : null}
                </div>
              </div>

              <h2 className="section-title">Endereço</h2>
              <div className="row">
                <div className="field">
                  <label htmlFor="cfg-cep">CEP</label>
                  <input id="cfg-cep" value={form.cep} inputMode="numeric" placeholder="00000-000" onChange={(e) => handleCep(e.target.value)} aria-invalid={Boolean(errors.cep)} />
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

              <div className="form-footer">
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          )}
        </div>

        <PasswordSection />
      </div>
    </>
  );
}
