import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useToast } from '../components/Toast';
import { AuthLayout } from '../layout/AuthLayout';
import { authErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';

export function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Digite um e-mail válido.');

    setError('');
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/nova-senha`,
      });
      if (resetError) return setError(authErrorMessage(resetError));
      setSent(true);
      toast.success('Link de recuperação enviado. Confira o seu e-mail.');
    } catch {
      setError(authErrorMessage(null));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <h1>Verifique seu e-mail</h1>
        <p className="muted" style={{ margin: '8px 0 20px' }}>
          Se existir uma conta para <strong>{email.trim()}</strong>, enviamos o link para criar uma nova senha.
        </p>
        <Link className="btn btn-primary btn-block" to="/entrar">
          Voltar para o login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Recuperar senha</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Informe seu e-mail para receber o link de recuperação.
      </p>
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar link'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/entrar">Voltar para o login</Link>
      </div>
    </AuthLayout>
  );
}
