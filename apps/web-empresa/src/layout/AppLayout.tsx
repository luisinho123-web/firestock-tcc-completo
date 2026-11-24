import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import logo from '../assets/logo.png';
import { usePartner } from '../partner/PartnerContext';

export function AppLayout() {
  const { signOut, user } = useAuth();
  const { partner } = usePartner();
  const onSettings = useLocation().pathname === '/configuracoes';
  const toast = useToast();
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [exiting, setExiting] = useState(false);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <img src={logo} alt="FireStock" />
          <div className="topbar-company">
            <strong>{partner?.trade_name ?? 'Minha empresa'}</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              {user?.email}
            </span>
          </div>
          {/* Configurações do perfil da empresa ficam junto do usuário, ao lado do Sair. */}
          <div className="topbar-actions" style={partner ? undefined : { marginLeft: 'auto' }}>
            {partner ? (
              <Link className={onSettings ? 'btn btn-navy btn-sm' : 'btn btn-ghost btn-sm'} to="/configuracoes" aria-current={onSettings ? 'page' : undefined}>
                Configurações
              </Link>
            ) : null}
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingExit(true)}>
              Sair
            </button>
          </div>
        </div>
        {partner?.status === 'approved' ? (
          <nav className="nav">
            <div className="nav-inner">
              <NavLink to="/painel" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Painel
              </NavLink>
              <NavLink to="/produtos" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Produtos
              </NavLink>
              <NavLink to="/reservas" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Pedidos
              </NavLink>
            </div>
          </nav>
        ) : null}
      </header>
      <main className="container">
        <Outlet />
      </main>
      {confirmingExit ? (
        <ConfirmDialog
          title="Sair do painel?"
          message="Você precisará entrar de novo com e-mail e senha para voltar."
          confirmLabel="Sair"
          busy={exiting}
          onCancel={() => setConfirmingExit(false)}
          onConfirm={async () => {
            setExiting(true);
            try {
              await signOut();
              toast.info('Você saiu da conta.');
            } finally {
              setExiting(false);
              setConfirmingExit(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
