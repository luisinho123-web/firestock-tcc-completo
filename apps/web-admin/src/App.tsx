import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { AdminProvider, useAdmin } from './admin/AdminContext';
import { useAuth } from './auth/AuthContext';
import { AdminLayout } from './layout/AdminLayout';
import { Commissions } from './pages/Commissions';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Partners } from './pages/Partners';

/** Sem sessão, tudo daqui para dentro volta para o login. */
function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <p className="muted" style={{ padding: 24 }}>Carregando…</p>;
  if (!session) return <Navigate to="/entrar" replace />;
  return (
    <AdminProvider>
      <Outlet />
    </AdminProvider>
  );
}

/** Só quem tem papel de administrador chega ao painel; os demais veem um aviso e podem sair. */
function RequireAdmin() {
  const { isAdmin, loading, error } = useAdmin();
  const { signOut, user } = useAuth();
  if (loading) return <p className="muted" style={{ padding: 24 }}>Carregando…</p>;
  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">Não foi possível verificar a sua permissão. Recarregue a página.</div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="card empty">
            <h2>Acesso restrito</h2>
            <p className="muted">
              A conta {user?.email} não tem permissão de administrador. Entre com uma conta da equipe do FireStock.
            </p>
            <button className="btn btn-navy" onClick={() => signOut()}>
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/empresas" element={<Partners />} />
            <Route path="/comissoes" element={<Commissions />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
