import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import { CompanyForm } from './pages/CompanyForm';
import { Dashboard } from './pages/Dashboard';
import { ForgotPassword } from './pages/ForgotPassword';
import { Login } from './pages/Login';
import { PendingApproval } from './pages/PendingApproval';
import { ProductFormPage } from './pages/ProductForm';
import { Products } from './pages/Products';
import { Reservations } from './pages/Reservations';
import { ResetPassword } from './pages/ResetPassword';
import { Settings } from './pages/Settings';
import { SignUp } from './pages/SignUp';
import { homePath, PartnerProvider, usePartner } from './partner/PartnerContext';

/** Sem sessão, tudo daqui para dentro volta para o login. */
function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <p className="muted" style={{ padding: 24 }}>Carregando…</p>;
  if (!session) return <Navigate to="/entrar" replace />;
  return (
    <PartnerProvider>
      <Outlet />
    </PartnerProvider>
  );
}

/** Espera carregar a empresa; se falhar, mostra o erro em vez de mandar a pessoa para o cadastro. */
function PartnerLoaded() {
  const { loading, error } = usePartner();
  if (loading) return <p className="muted" style={{ padding: 24 }}>Carregando…</p>;
  if (error) {
    return (
      <div className="container">
        <div className="alert alert-error">Não foi possível carregar os dados da empresa. Recarregue a página.</div>
      </div>
    );
  }
  return <Outlet />;
}

/** Só empresa aprovada chega à área de produtos (RN008). */
function RequireApproved() {
  const { partner } = usePartner();
  if (partner?.status !== 'approved') return <Navigate to={homePath(partner ?? null)} replace />;
  return <Outlet />;
}

function Home() {
  const { partner } = usePartner();
  return <Navigate to={homePath(partner)} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route path="/cadastro" element={<SignUp />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/nova-senha" element={<ResetPassword />} />

      <Route element={<RequireAuth />}>
        <Route element={<PartnerLoaded />}>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="/empresa" element={<CompanyForm />} />
            <Route path="/aguardando" element={<PendingApproval />} />
            <Route path="/configuracoes" element={<Settings />} />
            <Route path="/identidade" element={<Navigate to="/configuracoes" replace />} />
            <Route element={<RequireApproved />}>
              <Route path="/painel" element={<Dashboard />} />
              <Route path="/produtos" element={<Products />} />
              <Route path="/produtos/novo" element={<ProductFormPage />} />
              <Route path="/produtos/:id" element={<ProductFormPage />} />
              <Route path="/reservas" element={<Reservations />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
