/** ViaCEP lookup: pure, no React Native import, fetch/timeout injectable so it runs under plain Node.
 * Base: plano docs/superpowers/plans/2026-09-28-viacep-mapbox-avatar.md (Task 1). */

export type ViaCepAddress = { street: string; neighborhood: string; city: string; state: string };

export type ViaCepResult =
  | { status: 'found'; address: ViaCepAddress }
  | { status: 'not_found' }
  | { status: 'invalid_format' }
  | { status: 'network_error' };

type ViaCepRawResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

const DEFAULT_TIMEOUT_MS = 8000;

export async function lookupCep(
  cep: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ViaCepResult> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return { status: 'invalid_format' };

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal });
    if (!response.ok) return { status: 'network_error' };

    const data = (await response.json()) as ViaCepRawResponse;
    if (data.erro) return { status: 'not_found' };

    return {
      status: 'found',
      address: {
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      },
    };
  } catch {
    // Network failure, abort/timeout, or a body that isn't valid JSON all mean the same thing here:
    // the lookup didn't work, so the form falls back to manual entry.
    return { status: 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}
