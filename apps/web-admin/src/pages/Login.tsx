import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import logo from '../assets/logo.png';
import { IDLE_NOTICE_KEY, useAuth } from '../auth/AuthContext';
import { authErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';

export function Login() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
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
      navigate('/', { replace: true });
    } catch {
      setError(authErrorMessage(null));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img className="auth-logo" src={logo} alt="FireStock" />
        <div className="card">
          <h1>Administração</h1>
          <p className="muted" style={{ marginBottom: 20 }}>
            Acesso restrito à equipe do FireStock.
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
        </div>
      </div>
    </div>
  );
}
