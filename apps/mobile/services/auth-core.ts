/**
 * Auth logic with no React Native imports: the Supabase client is injected, so this file runs (and is
 * tested) under plain Node. `services/auth.ts` wires it to the real client.
 *
 * Base: plano docs/superpowers/plans/2026-09-28-supabase-migration.md (Step 3), ampliado com
 * requestPasswordReset / startRecoverySession / updatePassword (usados por forgot-password e new-password).
 */

/** Error with the HTTP status (0 for network failure / timeout) so screens can react by kind
 * instead of pattern-matching on message text. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** User-facing message for any error thrown by this module (or anything else). */
export function errorMessage(error: unknown, fallback = 'Tente novamente em instantes.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export type AuthResponse = {
  message: string;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export type AuthErrorLike = { message?: string; status?: number; code?: string; name?: string };

type UserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: unknown[] | null;
};
type SessionLike = { access_token: string; user: UserLike };
type SignInResult = { data: { user: UserLike | null; session: SessionLike | null }; error: AuthErrorLike | null };

/** The slice of the Supabase client this module uses. The real `SupabaseClient` satisfies it. */
export type AuthClientLike = {
  auth: {
    signUp(args: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }): Promise<SignInResult>;
    signInWithPassword(args: { email: string; password: string }): Promise<SignInResult>;
    signOut(): Promise<{ error: AuthErrorLike | null }>;
    getSession(): Promise<{ data: { session: SessionLike | null }; error: AuthErrorLike | null }>;
    resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<{ error: AuthErrorLike | null }>;
    setSession(args: { access_token: string; refresh_token: string }): Promise<{ error: AuthErrorLike | null }>;
    updateUser(attributes: { password: string }): Promise<{ error: AuthErrorLike | null }>;
  };
};

const NETWORK_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
const REQUEST_TIMEOUT_MS = 15000;

const networkError = () => new ApiError(NETWORK_MESSAGE, 0);

/** Maps a Supabase auth error to a pt-BR ApiError. Unknown errors never leak their internal message. */
export function mapAuthError(error: AuthErrorLike): ApiError {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return new ApiError('Este e-mail já está cadastrado.', 409);
    case 'invalid_credentials':
      return new ApiError('E-mail ou senha inválidos.', 401);
    case 'email_not_confirmed':
      return new ApiError('Confirme seu e-mail antes de entrar.', 403);
    case 'weak_password':
      return new ApiError('A senha é muito fraca. Use pelo menos 6 caracteres.', 422);
    case 'same_password':
      return new ApiError('A nova senha precisa ser diferente da atual.', 422);
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new ApiError(RATE_LIMIT_MESSAGE, 429);
    case 'signup_disabled':
      return new ApiError('Cadastros estão desativados no momento.', 403);
    case 'otp_expired':
    case 'session_not_found':
    case 'bad_jwt':
      return new ApiError('O link expirou ou já foi usado. Peça um novo.', 401);
    default:
      break;
  }

  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return networkError();
  }

  return new ApiError('Não foi possível concluir a operação.', error.status ?? 500);
}

function displayName(user: UserLike): string {
  const fromMetadata = user.user_metadata?.name;
  if (typeof fromMetadata === 'string' && fromMetadata.trim()) return fromMetadata.trim();
  // Login com o Google costuma trazer o nome em full_name.
  const fromFullName = user.user_metadata?.full_name;
  if (typeof fromFullName === 'string' && fromFullName.trim()) return fromFullName.trim();
  return (user.email ?? '').split('@')[0] || 'Usuário';
}

function toResponse(message: string, session: SessionLike): AuthResponse {
  return {
    message,
    token: session.access_token,
    user: { id: session.user.id, name: displayName(session.user), email: session.user.email ?? '' },
  };
}

export function createAuthService(client: AuthClientLike, options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  /** Runs a client call with the same 15 s ceiling the old fetch layer had; any throw becomes a network error. */
  async function guarded<T>(call: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        call(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(networkError()), timeoutMs);
        }),
      ]);
    } catch (error) {
      throw error instanceof ApiError ? error : networkError();
    } finally {
      clearTimeout(timer);
    }
  }

  async function registerUser(data: { name: string; email: string; password: string }): Promise<AuthResponse> {
    const { data: result, error } = await guarded(() =>
      client.auth.signUp({ email: data.email, password: data.password, options: { data: { name: data.name } } }),
    );
    if (error) throw mapAuthError(error);

    // With "Confirm email" on, Supabase answers a repeated sign-up with a fake user that has no identities
    // instead of an error (to avoid revealing which e-mails exist).
    if (result.user?.identities && result.user.identities.length === 0) {
      throw new ApiError('Este e-mail já está cadastrado.', 409);
    }
    if (!result.session) {
      throw new ApiError('Conta criada. Confirme seu e-mail para poder entrar.', 403);
    }
    return toResponse('Cadastro realizado com sucesso.', result.session);
  }

  async function loginUser(data: { email: string; password: string }): Promise<AuthResponse> {
    const { data: result, error } = await guarded(() => client.auth.signInWithPassword(data));
    if (error) throw mapAuthError(error);
    if (!result.session) throw new ApiError('Não foi possível concluir a operação.', 500);
    return toResponse('Login realizado com sucesso.', result.session);
  }

  async function signOutUser(): Promise<void> {
    const { error } = await guarded(() => client.auth.signOut());
    if (error) throw mapAuthError(error);
  }

  /** Session saved on the device, or null. Never rejects: a broken/expired stored session just means "signed out". */
  async function restoreSession(): Promise<AuthResponse | null> {
    try {
      const { data: result, error } = await guarded(() => client.auth.getSession());
      if (error || !result.session) return null;
      return toResponse('Sessão restaurada.', result.session);
    } catch {
      return null;
    }
  }

  /** Envia o e-mail de recuperação; `redirectTo` precisa estar nas Redirect URLs do Supabase. */
  async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await guarded(() => client.auth.resetPasswordForEmail(email, { redirectTo }));
    if (error) throw mapAuthError(error);
  }

  /** Abre a sessão temporária que vem no link do e-mail de recuperação. */
  async function startRecoverySession(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
    const { error } = await guarded(() =>
      client.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }),
    );
    if (error) throw mapAuthError(error);
  }

  async function updatePassword(password: string): Promise<void> {
    const { error } = await guarded(() => client.auth.updateUser({ password }));
    if (error) throw mapAuthError(error);
  }

  return { registerUser, loginUser, signOutUser, restoreSession, requestPasswordReset, startRecoverySession, updatePassword };
}
