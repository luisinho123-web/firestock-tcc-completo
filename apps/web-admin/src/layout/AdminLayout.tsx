import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAdmin } from '../admin/AdminContext';
import logo from '../assets/logo.png';
import { useAuth } from '../auth/AuthContext';

export function AdminLayout() {
  const { signOut, user } = useAuth();
  const { name } = useAdmin();
  const [exiting, setExiting] = useState(false);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <img src={logo} alt="FireStock" />
          <div className="topbar-company">
            <strong>Administração{name ? ` · ${name}` : ''}</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              {user?.email}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="btn btn-ghost btn-sm"
              disabled={exiting}
              onClick={async () => {
                setExiting(true);
                try {
                  await signOut();
                } finally {
                  setExiting(false);
                }
              }}>
              Sair
            </button>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-inner">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Painel
            </NavLink>
            <NavLink to="/empresas" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Empresas
            </NavLink>
            <NavLink to="/comissoes" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Comissões
            </NavLink>
          </div>
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
