import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { IDLE_NOTICE_KEY, useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { AuthLayout } from '../layout/AuthLayout';
import { authErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';

export function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [idleNotice] = useState(() => {
    try {
      const flag = sessionStorage.getItem(IDLE_NOTICE_KEY) === '1';
      sessionStorage.removeItem(IDLE_NOTICE_KEY);
      return flag;
    } catch {
      return false;
    }
  });

  if (!loading && session) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) return setError('Informe e-mail e senha.');

    setError('');
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) return setError(authErrorMessage(signInError));
      toast.success('Login realizado com sucesso!');
      navigate('/', { replace: true });
    } catch {
      setError(authErrorMessage(null));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1>Entrar</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Acesse o painel da sua empresa.
      </p>
      {idleNotice ? <div className="alert alert-warning" role="status">Sua sessão foi encerrada por inatividade. Entre de novo.</div> : null}
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
        <Link to="/cadastro">Cadastrar empresa</Link>
      </div>
    </AuthLayout>
  );
}
