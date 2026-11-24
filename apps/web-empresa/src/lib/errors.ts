type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/** Mensagens de erro do Supabase Auth em português; nada de texto interno vaza para a tela. */
export function authErrorMessage(error: ErrorLike): string {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha inválidos.';
    case 'email_not_confirmed':
      return 'Confirme seu e-mail antes de entrar.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Este e-mail já está cadastrado.';
    case 'weak_password':
      return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'same_password':
      return 'A nova senha precisa ser diferente da atual.';
    default:
      return error?.status === 0 || error?.message?.includes('fetch')
        ? 'Não foi possível conectar ao servidor. Verifique sua internet.'
        : 'Não foi possível concluir a operação. Tente novamente.';
  }
}
