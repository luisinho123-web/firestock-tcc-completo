import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthLayout } from '../layout/AuthLayout';
import { useToast } from '../components/Toast';
import { authErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';

/** Tokens que o Supabase coloca no fragmento do link: `#access_token=…&refresh_token=…&type=recovery`. */
function readRecoveryTokens() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { accessToken, refreshToken, expired: false };
  return { accessToken: null, refreshToken: null, expired: Boolean(params.get('error')) };
}

export function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const [recovery] = useState(readRecoveryTokens);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!recovery.accessToken || recovery.expired) {
    return (
      <AuthLayout>
        <h1>Link inválido</h1>
        <p className="muted" style={{ margin: '8px 0 20px' }}>
          Este link de recuperação expirou, já foi usado ou não está completo. Peça um novo.
        </p>
        <Link className="btn btn-primary btn-block" to="/esqueci-senha">
          Pedir novo link
        </Link>
      </AuthLayout>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !recovery.accessToken || !recovery.refreshToken) return;
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (password !== confirm) return setError('As senhas não são iguais.');

    setError('');
    setBusy(true);
    try {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: recovery.accessToken,
        refresh_token: recovery.refreshToken,
      });
      if (sessionError) return setError('Este link de recuperação expirou ou já foi usado. Peça um novo.');
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) return setError(authErrorMessage(updateError));
      // O link só prova quem a pessoa é: ela entra com a nova senha como qualquer outra.
      await supabase.auth.signOut().catch(() => undefined);
      toast.success('Senha alterada com sucesso. Entre com a nova senha.');
      navigate('/entrar', { replace: true });
    } catch {
      setError(authErrorMessage(null));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1>Crie uma nova senha</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Ela substitui a senha antiga.
      </p>
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="password">Nova senha</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirmar nova senha</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </AuthLayout>
  );
}
