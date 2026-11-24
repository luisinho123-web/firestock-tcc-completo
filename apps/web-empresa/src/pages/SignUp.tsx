import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useToast } from '../components/Toast';
import { AuthLayout } from '../layout/AuthLayout';
import { authErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';

export function SignUp() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError('Informe o nome do responsável.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Digite um e-mail válido.');
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (password !== confirm) return setError('As senhas não são iguais.');

    setError('');
    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim(), company: true }, emailRedirectTo: `${window.location.origin}/entrar` },
      });
      if (signUpError) return setError(authErrorMessage(signUpError));
      // Com "Confirm email" ligado, um e-mail já cadastrado volta como usuário sem identidades.
      if (data.user?.identities && data.user.identities.length === 0) return setError('Este e-mail já está cadastrado.');
      setSent(true);
      toast.success('Acesso criado! Enviamos o link de confirmação para o seu e-mail.');
    } catch {
      setError(authErrorMessage(null));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <h1>Confirme seu e-mail</h1>
        <p className="muted" style={{ margin: '8px 0 20px' }}>
          Enviamos um link de confirmação para <strong>{email.trim()}</strong>. Depois de confirmar, entre para cadastrar os dados da sua
          empresa.
        </p>
        <Link className="btn btn-primary btn-block" to="/entrar">
          Ir para o login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Criar acesso da empresa</h1>
      <p className="muted" style={{ marginBottom: 20 }}>
        Primeiro o seu acesso. Os dados da empresa vêm em seguida.
      </p>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
          {error.includes('já está cadastrado') ? (
            <>
              {' '}
              <Link to="/entrar">Entrar</Link> ou <Link to="/esqueci-senha">recuperar a senha</Link>.
            </>
          ) : null}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">Nome do responsável</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirmar senha</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Criando…' : 'Criar acesso'}
        </button>
      </form>
      <div className="auth-links">
        <span className="muted">Já tem acesso?</span>
        <Link to="/entrar">Entrar</Link>
      </div>
    </AuthLayout>
  );
}
