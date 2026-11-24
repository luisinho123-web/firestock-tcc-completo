import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { listPartners } from '../admin/api';
import { getPlatformCommission, listPartnerCommissions, setPartnerCommission, setPlatformCommission } from '../admin/commissions-api';
import { useToast } from '../components/Toast';
import type { PartnerRef } from '../lib/admin-rules';
import { COMMISSION_MAX, commissionOn, formatPercent, parsePercent } from '../lib/commission-rules';
import { formatCents } from '../lib/money';

const EXAMPLE_SALE_CENTS = 10000; // R$ 100,00

const PERCENT_ERROR = `Use um número de 0 a ${COMMISSION_MAX}, com até 2 casas (ex.: 10 ou 4,5).`;

export function Commissions() {
  const toast = useToast();
  const [platform, setPlatform] = useState<number | null>(null);
  const [special, setSpecial] = useState<Map<string, number>>(new Map());
  const [partners, setPartners] = useState<PartnerRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [platformInput, setPlatformInput] = useState('');
  const [platformError, setPlatformError] = useState('');
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [editing, setEditing] = useState<{ partnerId: string; value: string; error: string } | null>(null);
  const [busyPartner, setBusyPartner] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rate, overrides, list] = await Promise.all([getPlatformCommission(), listPartnerCommissions(), listPartners()]);
      setPlatform(rate);
      setPlatformInput(String(rate).replace('.', ','));
      setSpecial(overrides);
      setPartners(list.filter((partner) => partner.status === 'approved'));
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as comissões.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return partners
      .filter((partner) => !term || partner.trade_name.toLowerCase().includes(term))
      .sort((a, b) => Number(special.has(b.id)) - Number(special.has(a.id)) || a.trade_name.localeCompare(b.trade_name, 'pt-BR'));
  }, [partners, search, special]);

  const savePlatform = async (event: FormEvent) => {
    event.preventDefault();
    const value = parsePercent(platformInput);
    if (value === null) {
      setPlatformError(PERCENT_ERROR);
      return;
    }
    setSavingPlatform(true);
    try {
      await setPlatformCommission(value);
      setPlatform(value);
      setPlatformError('');
      toast.success(`Taxa padrão agora é ${formatPercent(value)}. Vale para as próximas vendas.`);
    } catch (saveError) {
      setPlatformError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.');
    } finally {
      setSavingPlatform(false);
    }
  };

  const savePartner = async (partner: PartnerRef, percent: number | null) => {
    setBusyPartner(partner.id);
    try {
      await setPartnerCommission(partner.id, percent);
      setSpecial((current) => {
        const next = new Map(current);
        if (percent === null) next.delete(partner.id);
        else next.set(partner.id, percent);
        return next;
      });
      setEditing(null);
      toast.success(
        percent === null
          ? `"${partner.trade_name}" voltou a usar a taxa padrão.`
          : `"${partner.trade_name}" agora paga ${formatPercent(percent)} de comissão nas próximas vendas.`,
      );
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Não foi possível salvar.';
      if (percent !== null) setEditing((current) => (current ? { ...current, error: message } : current));
      else toast.error(message);
    } finally {
      setBusyPartner(null);
    }
  };

  const submitEditing = (partner: PartnerRef) => {
    if (!editing) return;
    const value = parsePercent(editing.value);
    if (value === null) {
      setEditing({ ...editing, error: PERCENT_ERROR });
      return;
    }
    savePartner(partner, value);
  };

  const previewValue = parsePercent(platformInput);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Comissões</h1>
          <p className="muted">
            Quanto o FireStock fica de cada venda: uma porcentagem sobre o valor dos produtos (sem a taxa de entrega). Cada venda guarda a taxa do momento em
            que foi concluída, então mudar aqui vale só para as próximas.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      {loading && platform === null && !error ? (
        <p className="muted">Carregando…</p>
      ) : platform === null ? null : (
        <div className="settings">
          <form className="card" onSubmit={savePlatform} noValidate>
            <h2 className="card-title">Taxa padrão</h2>
            <p className="muted card-subtitle">Vale para todas as empresas que não têm uma taxa especial.</p>
            <div className="field" style={{ maxWidth: 360 }}>
              <label htmlFor="platform-rate">Comissão (%)</label>
              <div className="pickup-code-row">
                <input
                  id="platform-rate"
                  inputMode="decimal"
                  value={platformInput}
                  onChange={(e) => {
                    setPlatformInput(e.target.value);
                    setPlatformError('');
                  }}
                  aria-invalid={platformError ? true : undefined}
                  aria-describedby="platform-rate-hint"
                />
                <button className="btn btn-primary" type="submit" disabled={savingPlatform}>
                  {savingPlatform ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
              <span id="platform-rate-hint" className={platformError ? 'error' : 'hint'} role={platformError ? 'alert' : undefined}>
                {platformError ||
                  (previewValue !== null
                    ? `Numa venda de ${formatCents(EXAMPLE_SALE_CENTS)}, o FireStock fica com ${formatCents(commissionOn(EXAMPLE_SALE_CENTS, previewValue))} e a loja com ${formatCents(EXAMPLE_SALE_CENTS - commissionOn(EXAMPLE_SALE_CENTS, previewValue))}.`
                    : PERCENT_ERROR)}
              </span>
            </div>
          </form>

          <section className="card">
            <h2 className="card-title">Taxas por empresa</h2>
            <p className="muted card-subtitle">
              Defina uma taxa especial para uma empresa (ex.: parceira de lançamento). Sem taxa especial, ela paga a padrão ({formatPercent(platform)}).
            </p>
            {partners.length > 6 ? (
              <div className="field" style={{ maxWidth: 360 }}>
                <input placeholder="Buscar empresa" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar empresa" />
              </div>
            ) : null}
            {visible.length === 0 ? (
              <p className="muted">{partners.length === 0 ? 'Nenhuma empresa aprovada ainda.' : 'Nenhuma empresa encontrada.'}</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th className="num">Taxa</th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((partner) => {
                      const custom = special.get(partner.id);
                      const isEditing = editing?.partnerId === partner.id;
                      return (
                        <tr key={partner.id}>
                          <td className="strong">{partner.trade_name}</td>
                          <td className="num">
                            {custom !== undefined ? (
                              <span className="badge badge-discount">{formatPercent(custom)} especial</span>
                            ) : (
                              <span className="muted">{formatPercent(platform)} padrão</span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <form
                                className="commission-edit"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  submitEditing(partner);
                                }}
                                noValidate>
                                <input
                                  autoFocus
                                  inputMode="decimal"
                                  value={editing.value}
                                  onChange={(e) => setEditing({ ...editing, value: e.target.value, error: '' })}
                                  aria-label={`Taxa especial de ${partner.trade_name} (%)`}
                                  aria-invalid={editing.error ? true : undefined}
                                />
                                <button className="btn btn-primary btn-sm" type="submit" disabled={busyPartner === partner.id}>
                                  Salvar
                                </button>
                                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(null)} disabled={busyPartner === partner.id}>
                                  Voltar
                                </button>
                                {editing.error ? (
                                  <span className="field-error" role="alert">
                                    {editing.error}
                                  </span>
                                ) : null}
                              </form>
                            ) : (
                              <div className="actions" style={{ justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() =>
                                    setEditing({ partnerId: partner.id, value: String(custom ?? platform).replace('.', ','), error: '' })
                                  }>
                                  {custom !== undefined ? 'Alterar' : 'Definir taxa especial'}
                                </button>
                                {custom !== undefined ? (
                                  <button className="btn btn-ghost btn-sm" onClick={() => savePartner(partner, null)} disabled={busyPartner === partner.id}>
                                    Usar padrão
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
