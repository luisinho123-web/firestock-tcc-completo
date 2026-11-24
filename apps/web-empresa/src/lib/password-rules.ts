export type PasswordChangeInput = { current: string; next: string; confirm: string };
export type PasswordChangeErrors = Partial<Record<keyof PasswordChangeInput, string>>;

export const MIN_PASSWORD_LENGTH = 8;

/** Regras da troca de senha: senha atual obrigatória, nova com 8+ caracteres, letras e números, diferente da atual. */
export function validatePasswordChange({ current, next, confirm }: PasswordChangeInput): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};
  if (!current) errors.current = 'Informe a senha atual.';
  if (next.length < MIN_PASSWORD_LENGTH) errors.next = `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  else if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) errors.next = 'Use letras e números na nova senha.';
  else if (next === current) errors.next = 'A nova senha precisa ser diferente da atual.';
  if (next !== confirm) errors.confirm = 'As senhas não são iguais.';
  return errors;
}
