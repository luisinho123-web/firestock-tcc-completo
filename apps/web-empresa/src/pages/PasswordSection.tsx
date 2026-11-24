import { useState, type FormEvent } from 'react';

import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { useUnsavedChanges } from '../components/UnsavedChanges';
import { authErrorMessage } from '../lib/errors';
import { validatePasswordChange, type PasswordChangeErrors } from '../lib/password-rules';
import { supabase } from '../lib/supabase';

/** Troca da senha de acesso do e-mail cadastrado. Pede a senha atual (confirma que é a própria pessoa) antes de gravar. */
export function PasswordSection() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  useUnsavedChanges('settings-password', Boolean(current || next || confirm));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !user?.email) return;
    const found = validatePasswordChange({ current, next, confirm });
    setErrors(found);
    if (Object.keys(found).length > 0) return toast.error('Revise os campos destacados.');

    setBusy(true);
    try {
      // Reautentica com a senha atual: sem isso, quem usasse um computador deixado aberto poderia trocar a senha.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (signInError) {
        if (signInError.code === 'invalid_credentials') {
          setErrors({ current: 'Senha atual incorreta.' });
          return toast.error('Senha atual incorreta.');
        }
        return toast.error(authErrorMessage(signInError));
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) return toast.error(authErrorMessage(updateError));

      // Encerra os outros dispositivos/navegadores que ainda estejam com a senha antiga.
      await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrors({});
      toast.success('Senha alterada com sucesso. Os outros dispositivos conectados foram desconectados.');
    } catch {
      toast.error('Não foi possível conectar ao servidor. Verifique sua internet.');
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, error: string | undefined, autoComplete: string) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="password" value={value} onChange={(e) => set(e.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} />
      {error ? <span className="error">{error}</span> : null}
    </div>
  );

  return (
    <div className="card">
      <h2 className="card-title">Senha de acesso</h2>
      <p className="muted card-subtitle">
        Altere a senha do e-mail cadastrado{user?.email ? <> (<strong>{user.email}</strong>)</> : null}. Use 8 ou mais caracteres, com letras e números.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="row">
          {field('pwd-current', 'Senha atual', current, setCurrent, errors.current, 'current-password')}
          {field('pwd-next', 'Nova senha', next, setNext, errors.next, 'new-password')}
          {field('pwd-confirm', 'Confirmar nova senha', confirm, setConfirm, errors.confirm, 'new-password')}
        </div>
        <div className="form-footer">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Alterando…' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
