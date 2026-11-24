import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listPartnerDetails, reviewPartner } from '../admin/partners-api';
import { useToast } from '../components/Toast';
import {
  canApprove,
  canReject,
  countByStatus,
  filterPartners,
  formatAddress,
  formatCnpj,
  formatPhone,
  PARTNER_STATUS_LABEL,
  REJECTION_REASON_MAX,
  rejectionReasonError,
  sortPartners,
  type PartnerDetail,
  type StatusFilter,
} from '../lib/partner-rules';

const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'pending', label: 'Aguardando' },
  { key: 'approved', label: 'Aprovadas' },
  { key: 'rejected', label: 'Recusadas' },
  { key: 'all', label: 'Todas' },
];

const BADGE: Record<PartnerDetail['status'], string> = { pending: 'badge-pending', approved: 'badge-active', rejected: 'badge-expired' };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

const isStatusFilter = (value: string | null): value is StatusFilter => TABS.some((tab) => tab.key === value);

type Decision = { partner: PartnerDetail; approve: boolean };

export function Partners() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('situacao');
  const tab: StatusFilter = isStatusFilter(tabParam) ? tabParam : 'pending';
  const [partners, setPartners] = useState<PartnerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPartners(await listPartnerDetails());
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as empresas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => countByStatus(partners), [partners]);
  const visible = useMemo(() => sortPartners(filterPartners(partners, tab, search)), [partners, tab, search]);

  const openDecision = (partner: PartnerDetail, approve: boolean) => {
    setDecision({ partner, approve });
    setReason('');
    setReasonError('');
  };

  const closeDecision = () => {
    if (!saving) setDecision(null);
  };

  const submitDecision = async () => {
    if (!decision) return;
    const { partner, approve } = decision;
    if (!approve) {
      const problem = rejectionReasonError(reason);
      if (problem) {
        setReasonError(problem);
        return;
      }
    }
    setSaving(true);
    try {
      const status = await reviewPartner(partner.id, approve, reason);
      // Atualiza só a linha alterada; a lista inteira é recarregada no próximo "Atualizar".
      setPartners((current) =>
        current.map((item) =>
          item.id === partner.id
            ? {
                ...item,
                status,
                rejection_reason: status === 'rejected' ? reason.trim() : null,
                approved_at: status === 'approved' ? new Date().toISOString() : null,
              }
            : item,
        ),
      );
      toast.success(
        approve
          ? `"${partner.trade_name}" foi aprovada. A empresa já pode publicar produtos.`
          : `"${partner.trade_name}" foi recusada. A empresa verá o motivo ao entrar no painel.`,
      );
      setDecision(null);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Não foi possível salvar a decisão.';
      if (approve) toast.error(message);
      else setReasonError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Empresas</h1>
          <p className="muted">Confira os dados do cadastro e aprove ou recuse. Só empresas aprovadas publicam produtos no app.</p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <div className="partner-toolbar">
        <div className="status-tabs" role="tablist" aria-label="Situação do cadastro">
          {TABS.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? 'status-tab active' : 'status-tab'}
              onClick={() => setParams(item.key === 'pending' ? {} : { situacao: item.key }, { replace: true })}>
              {item.label} <span className="status-tab-count">{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <div className="field partner-search">
          <input placeholder="Buscar por nome, CNPJ, cidade ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar empresa" />
        </div>
      </div>

      {loading && partners.length === 0 ? (
        <p className="muted">Carregando…</p>
      ) : visible.length === 0 ? (
        <div className="card empty">
          <p className="muted">
            {search ? 'Nenhuma empresa encontrada com essa busca.' : tab === 'pending' ? 'Nenhum cadastro aguardando aprovação.' : 'Nenhuma empresa nesta situação.'}
          </p>
        </div>
      ) : (
        <div className="partner-list">
          {visible.map((partner) => (
            <article className="partner-card" key={partner.id}>
              <header className="partner-card-head">
                {partner.logo_url ? <img className="partner-logo" src={partner.logo_url} alt="" /> : <div className="partner-logo">{partner.trade_name.slice(0, 1).toUpperCase()}</div>}
                <div className="partner-title">
                  <h2>{partner.trade_name}</h2>
                  <span className="muted">{partner.legal_name}</span>
                </div>
                <span className={`badge ${BADGE[partner.status]}`}>{PARTNER_STATUS_LABEL[partner.status]}</span>
              </header>

              <dl className="partner-details">
                <div>
                  <dt>CNPJ</dt>
                  <dd>{formatCnpj(partner.cnpj)}</dd>
                </div>
                <div>
                  <dt>Categoria</dt>
                  <dd>{partner.category ?? '—'}</dd>
                </div>
                <div>
                  <dt>Telefone</dt>
                  <dd>{formatPhone(partner.phone)}</dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>{partner.email ?? '—'}</dd>
                </div>
                <div className="partner-details-wide">
                  <dt>Endereço</dt>
                  <dd>{formatAddress(partner)}</dd>
                </div>
                <div>
                  <dt>Cadastrada em</dt>
                  <dd>{formatDate(partner.created_at)}</dd>
                </div>
                {partner.approved_at ? (
                  <div>
                    <dt>Aprovada em</dt>
                    <dd>{formatDate(partner.approved_at)}</dd>
                  </div>
                ) : null}
              </dl>

              {partner.status === 'rejected' && partner.rejection_reason ? (
                <div className="alert alert-error partner-reason">
                  <strong>Motivo da recusa:</strong> {partner.rejection_reason}
                </div>
              ) : null}

              {canApprove(partner.status) || canReject(partner.status) ? (
                <div className="actions partner-actions">
                  {canReject(partner.status) ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => openDecision(partner, false)}>
                      Recusar
                    </button>
                  ) : null}
                  {canApprove(partner.status) ? (
                    <button className="btn btn-primary btn-sm" onClick={() => openDecision(partner, true)}>
                      {partner.status === 'rejected' ? 'Aprovar mesmo assim' : 'Aprovar'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {decision ? (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="decision-title" onKeyDown={(e) => e.key === 'Escape' && closeDecision()}>
          <div className="dialog dialog-wide">
            <h2 id="decision-title">{decision.approve ? 'Aprovar empresa?' : 'Recusar cadastro?'}</h2>
            {decision.approve ? (
              <p>
                <strong>{decision.partner.trade_name}</strong> poderá publicar produtos e eles passam a aparecer no app para os consumidores.
              </p>
            ) : (
              <>
                <p>
                  <strong>{decision.partner.trade_name}</strong> não poderá publicar produtos. O motivo aparece para a empresa no painel dela.
                </p>
                <div className="field">
                  <label htmlFor="rejection-reason">Motivo da recusa</label>
                  <textarea
                    id="rejection-reason"
                    autoFocus
                    maxLength={REJECTION_REASON_MAX}
                    placeholder="Ex.: o CNPJ informado não corresponde à razão social."
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setReasonError('');
                    }}
                    aria-invalid={reasonError ? true : undefined}
                    aria-describedby="rejection-reason-hint"
                  />
                  <span id="rejection-reason-hint" className={reasonError ? 'error' : 'hint'} role={reasonError ? 'alert' : undefined}>
                    {reasonError || `${reason.trim().length}/${REJECTION_REASON_MAX} caracteres`}
                  </span>
                </div>
              </>
            )}
            <div className="actions">
              <button className="btn btn-ghost" onClick={closeDecision} disabled={saving}>
                Voltar
              </button>
              <button className={decision.approve ? 'btn btn-primary' : 'btn btn-danger'} onClick={submitDecision} disabled={saving}>
                {saving ? 'Salvando…' : decision.approve ? 'Aprovar' : 'Recusar cadastro'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
