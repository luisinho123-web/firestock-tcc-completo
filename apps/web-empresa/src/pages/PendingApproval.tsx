import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { homePath, usePartner } from '../partner/PartnerContext';
import { useToast } from '../components/Toast';

export function PendingApproval() {
  const { partner, reload } = usePartner();
  const [checking, setChecking] = useState(false);
  const toast = useToast();
  const mediaFailed = Boolean((useLocation().state as { mediaFailed?: boolean } | null)?.mediaFailed);

  if (!partner || partner.status === 'approved') return <Navigate to={homePath(partner)} replace />;

  const recheck = async () => {
    setChecking(true);
    const latest = await reload();
    setChecking(false);
    if (latest?.status === 'approved') toast.success('Seu cadastro foi aprovado! Você já pode publicar produtos.');
    else if (latest?.status === 'rejected') toast.info('Status atualizado: o cadastro foi recusado. Veja o motivo abaixo.');
    else toast.info('Status verificado: seu cadastro ainda está aguardando aprovação.');
  };

  const rejected = partner.status === 'rejected';

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <span className={`badge ${rejected ? 'badge-expired' : 'badge-pending'}`}>{rejected ? 'Cadastro recusado' : 'Aguardando aprovação'}</span>
      <h1 style={{ marginTop: 12 }}>{partner.trade_name}</h1>
      {mediaFailed ? (
        <div className="alert alert-warning" role="status" style={{ marginTop: 12 }}>
          O cadastro foi enviado, mas não conseguimos enviar a logo ou o banner. Envie de novo em <Link to="/configuracoes">Configurações</Link>.
        </div>
      ) : null}
      {rejected ? (
        <>
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Seu cadastro não foi aprovado.
          </p>
          <div className="alert alert-error">{partner.rejection_reason || 'Entre em contato com o suporte do FireStock para mais detalhes.'}</div>
        </>
      ) : (
        <p className="muted" style={{ margin: '8px 0 20px' }}>
          Recebemos os dados da sua empresa. Assim que o cadastro for aprovado você poderá publicar seus produtos. Volte aqui e confira o
          andamento.
        </p>
      )}
      <button className="btn btn-navy" onClick={recheck} disabled={checking}>
        {checking ? 'Verificando…' : 'Verificar novamente'}
      </button>
    </div>
  );
}
