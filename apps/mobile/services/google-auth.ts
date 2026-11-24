/**
 * Login com o Google pelo Supabase Auth (provedor "Google" precisa estar ativado no painel do Supabase,
 * e a URL de retorno em Authentication → URL Configuration → Redirect URLs).
 *
 * ATENÇÃO: RECRIADO (o arquivo original não veio no pacote). Não foi testado com o Google real.
 *  - Web: redireciona a página para o Google e volta em /auth-callback.
 *  - App: abre o navegador do sistema, e o retorno chega como link profundo (meuprojeto://auth-callback).
 */

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export type GoogleSignInResult = 'signed_in' | 'redirecting' | 'cancelled';

/** Lê os parâmetros que o Supabase devolve na URL (no fragmento "#..." ou na query "?..."). */
function readParams(url: string): URLSearchParams {
  const params = new URLSearchParams();
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    new URLSearchParams(url.slice(queryIndex + 1, end)).forEach((value, key) => params.set(key, value));
  }
  if (hashIndex >= 0) {
    new URLSearchParams(url.slice(hashIndex + 1)).forEach((value, key) => params.set(key, value));
  }
  return params;
}

/** Abre a sessão a partir da URL de retorno. Devolve false se a URL não trouxe nada utilizável. */
export async function completeOAuthFromUrl(url: string): Promise<boolean> {
  const params = readParams(url);

  const failure = params.get('error_description') ?? params.get('error');
  if (failure) throw new Error(failure.replace(/\+/g, ' '));

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error('Não foi possível concluir o login com o Google.');
    return true;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw new Error('Não foi possível concluir o login com o Google.');
    return true;
  }

  return false;
}

export async function startGoogleSignIn(): Promise<GoogleSignInResult> {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth-callback` },
    });
    if (error) throw new Error('Não foi possível iniciar o login com o Google.');
    return 'redirecting';
  }

  const redirectTo = Linking.createURL('/auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error('Não foi possível iniciar o login com o Google.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';

  return (await completeOAuthFromUrl(result.url)) ? 'signed_in' : 'cancelled';
}
