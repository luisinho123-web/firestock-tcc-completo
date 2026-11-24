# CEP real, mapa real e foto de perfil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar do zero, no FireStock: busca de CEP via ViaCEP com autopreenchimento do endereço, mapa real (Mapbox Static Images) na tela de novo/editar endereço, e upload real de foto de perfil persistida no Supabase (Storage + `profiles.avatar_url`), sem regredir nada que já funciona.

**Architecture:** Dois módulos puros e testáveis no padrão de `services/auth-core.ts` (`services/viacep.ts`, `services/mapbox.ts`), com `fetch`/timeout injetáveis via `AbortController`. Um terceiro módulo (`services/profile.ts`) segue o padrão de `createAuthService` (client Supabase injetado) para o upload de avatar. Endereços continuam 100% locais (`contexts/addresses-context.tsx`); só a foto de perfil toca o banco (migration pequena + bucket de Storage).

**Tech Stack:** `fetch`/`AbortController` nativos (Node 26 e RN/Expo), `expo-image` (já presente) para renderizar o mapa e a foto, `expo-image-picker` (nova dependência), Supabase Storage + Postgres (MCP), `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-28-viacep-mapbox-avatar-design.md`

## Global Constraints

- Projeto Supabase: `grvhxufpbvgvgurjaavb` (mesmo da migração anterior). Não criar outro.
- **Nenhum commit**, salvo se o usuário pedir (repositório sem commits, git enxerga `Documents` como raiz).
- Sem token do Mapbox (`EXPO_PUBLIC_MAPBOX_TOKEN` vazio/ausente), `geocodeAddress` e `staticMapUrl` devolvem `null`/`undefined` **sem lançar erro** — o formulário de endereço continua salvável exatamente como hoje (fallback `editingAddress ?? CASCAVEL_CENTER`).
- ViaCEP não usa token; falha de rede nunca bloqueia o formulário — a pessoa preenche manualmente, como hoje.
- Bucket `avatars` no Storage é **público**; escrita (`insert/update/delete`) restrita ao próprio usuário via RLS em `storage.objects`, caminho `{uid}/avatar.{ext}`.
- Endereços continuam sem persistência no Supabase — fora de escopo.
- `services/auth.ts`, `contexts/profile-context.tsx` (campos já existentes), `app/login.tsx`, `app/register.tsx` não perdem nenhum comportamento hoje funcional.
- Textos voltados ao usuário em português (pt-BR).
- Timeout de 8 s nas chamadas HTTP de ViaCEP/Mapbox, via `AbortController` (não via `Promise.race`, que é o padrão usado em `auth-core.ts` para SDKs sem `signal` — aqui é `fetch` puro, que aceita `signal` diretamente).

## Review Focus

1. **CEP de 8 dígitos que não existe** (ex.: `00000000`) — ViaCEP devolve `{"erro":true}`; o campo deve mostrar "CEP não encontrado.", nunca preencher campos com lixo. → Task 1.
2. **Rede cai no meio da digitação do CEP** — o formulário tem que continuar preenchível à mão, sem travar o botão Salvar. → Tasks 1 e 3.
3. **Duas edições rápidas de CEP** (a pessoa corrige um dígito antes da primeira busca terminar) — a resposta da busca antiga não pode sobrescrever o que já foi digitado por cima. → Task 3 (debounce + `AbortController` por requisição).
4. **Trocar a foto, sair do app antes do upload terminar, voltar** — a tela não pode ficar mostrando uma prévia local que nunca foi salva como se fosse a foto real. → Task 9 (reverte prévia em erro; o contexto só reflete o que veio do banco, não o que está em upload).
5. **Foto salva por um usuário aparecendo para outro** (bucket público + upload malformado) — outro usuário não pode escrever no caminho `{uid}` de alguém, e a leitura de um `avatar_url` de outro perfil não pode ser bloqueada indevidamente (é pública por decisão). → Task 5 (verificação de RLS do Storage).

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `services/viacep.ts` (novo) | Busca de CEP, pura e testável |
| `services/viacep.test.mjs` (novo) | Testes de `viacep.ts` |
| `services/mapbox.ts` (novo) | Geocodificação e URL do mapa estático, pura e testável |
| `services/mapbox.test.mjs` (novo) | Testes de `mapbox.ts` |
| `services/profile.ts` (novo) | Upload de avatar e leitura do perfil, client injetado |
| `services/profile.test.mjs` (novo) | Testes de `profile.ts` |
| `services/supabase.ts` (alterado) | Exporta `createProfileService(supabase)` já instanciado |
| `app/new-address.tsx` (alterado) | Autopreenchimento por CEP + mapa real |
| `.env.example`, `.env.local` (alterados) | `EXPO_PUBLIC_MAPBOX_TOKEN` |
| `app.json` (alterado) | Plugin `expo-image-picker` com textos de permissão |
| `package.json` (alterado) | Nova dependência `expo-image-picker` |
| `contexts/profile-context.tsx` (alterado) | `userId`/`avatarUrl`, busca do perfil após sessão restaurada/login |
| `app/login.tsx`, `app/register.tsx` (alterados) | Preenchem `userId` no contexto logo após login/cadastro |
| `app/account.tsx` (alterado) | Fluxo de trocar foto (câmera/galeria/upload) |
| `app/(tabs)/profile.tsx` (alterado) | Exibe a foto quando existir |

Migration do banco (via MCP `apply_migration`): `add_profiles_avatar_and_storage`.

---

### Task 1: `services/viacep.ts` (TDD)

**Files:**
- Create: `services/viacep.ts`
- Test: `services/viacep.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces (usado na Task 3): `export type ViaCepAddress = { street: string; neighborhood: string; city: string; state: string }`; `export type ViaCepResult = { status: 'found'; address: ViaCepAddress } | { status: 'not_found' } | { status: 'invalid_format' } | { status: 'network_error' }`; `export async function lookupCep(cep: string, options?: { fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<ViaCepResult>`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `services/viacep.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { lookupCep } from './viacep.ts';

function fetchReturning(body, init = { status: 200 }) {
  return async () => new Response(JSON.stringify(body), init);
}

test('CEP com menos de 8 dígitos não chama a rede e devolve invalid_format', async () => {
  let called = false;
  const result = await lookupCep('1234', { fetchImpl: async () => { called = true; return new Response('{}'); } });
  assert.equal(called, false);
  assert.deepEqual(result, { status: 'invalid_format' });
});

test('CEP com 8 dígitos e traço é aceito e a rede é chamada só com dígitos', async () => {
  let calledUrl = '';
  const fetchImpl = async (url) => {
    calledUrl = String(url);
    return new Response(JSON.stringify({ logradouro: 'Av. Brasil', bairro: 'Centro', localidade: 'Cascavel', uf: 'PR' }));
  };
  const result = await lookupCep('85810-010', { fetchImpl });
  assert.equal(calledUrl, 'https://viacep.com.br/ws/85810010/json/');
  assert.deepEqual(result, {
    status: 'found',
    address: { street: 'Av. Brasil', neighborhood: 'Centro', city: 'Cascavel', state: 'PR' },
  });
});

test('CEP inexistente ({erro:true}) devolve not_found', async () => {
  const result = await lookupCep('00000000', { fetchImpl: fetchReturning({ erro: true }) });
  assert.deepEqual(result, { status: 'not_found' });
});

test('resposta HTTP não-OK devolve network_error', async () => {
  const result = await lookupCep('85810010', { fetchImpl: fetchReturning({}, { status: 500 }) });
  assert.deepEqual(result, { status: 'network_error' });
});

test('fetch que rejeita devolve network_error', async () => {
  const result = await lookupCep('85810010', {
    fetchImpl: async () => {
      throw new TypeError('Network request failed');
    },
  });
  assert.deepEqual(result, { status: 'network_error' });
});

test('corpo que não é JSON válido devolve network_error', async () => {
  const result = await lookupCep('85810010', { fetchImpl: async () => new Response('não é json') });
  assert.deepEqual(result, { status: 'network_error' });
});

test('estoura o timeout e devolve network_error, respeitando o AbortSignal', async () => {
  const fetchImpl = (url, init) =>
    new Promise((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  const result = await lookupCep('85810010', { fetchImpl, timeoutMs: 20 });
  assert.deepEqual(result, { status: 'network_error' });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test services/viacep.test.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `./viacep.ts`.

- [ ] **Step 3: Implementar `services/viacep.ts`**

```ts
/** ViaCEP lookup: pure, no React Native import, fetch/timeout injectable so it runs under plain Node. */

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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test services/viacep.test.mjs`
Expected: 7/7 PASS.

- [ ] **Step 5: Checkpoint**

Run: `npm test` (glob já cobre `services/**/*.test.mjs`) → todos os testes existentes + os 7 novos passam. `npx tsc --noEmit` limpo.

---

### Task 2: `services/mapbox.ts` (TDD)

**Files:**
- Create: `services/mapbox.ts`
- Test: `services/mapbox.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces (usado na Task 3): `export type Coordinates = { lat: number; lng: number }`; `export function getMapboxToken(): string | undefined`; `export async function geocodeAddress(query: string, options?: { fetchImpl?: typeof fetch; timeoutMs?: number; token?: string }): Promise<Coordinates | null>`; `export function staticMapUrl(params: { lat: number; lng: number; width?: number; height?: number; zoom?: number; token?: string }): string | null`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `services/mapbox.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { geocodeAddress, staticMapUrl } from './mapbox.ts';

test('sem token, geocodeAddress devolve null sem chamar a rede', async () => {
  let called = false;
  const result = await geocodeAddress('Av. Brasil, Cascavel', {
    token: '',
    fetchImpl: async () => {
      called = true;
      return new Response('{}');
    },
  });
  assert.equal(called, false);
  assert.equal(result, null);
});

test('geocodeAddress lê [lng, lat] do GeoJSON e devolve {lat, lng}', async () => {
  let calledUrl = '';
  const fetchImpl = async (url) => {
    calledUrl = String(url);
    return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-53.4552, -24.9555] } }] }));
  };
  const result = await geocodeAddress('Av. Brasil, Cascavel', { token: 'pk.teste', fetchImpl });
  assert.deepEqual(result, { lat: -24.9555, lng: -53.4552 });
  assert.match(calledUrl, /^https:\/\/api\.mapbox\.com\/search\/geocode\/v6\/forward\?/);
  assert.match(calledUrl, /access_token=pk\.teste/);
  assert.match(calledUrl, /country=br/);
  assert.match(calledUrl, /q=Av\.\+Brasil%2C\+Cascavel|q=Av\.%20Brasil%2C%20Cascavel/);
});

test('sem resultados (features vazio), devolve null', async () => {
  const result = await geocodeAddress('endereço inexistente', {
    token: 'pk.teste',
    fetchImpl: async () => new Response(JSON.stringify({ features: [] })),
  });
  assert.equal(result, null);
});

test('erro de rede ou HTTP não-OK devolve null (não lança)', async () => {
  const resultNetworkFail = await geocodeAddress('x', {
    token: 'pk.teste',
    fetchImpl: async () => {
      throw new TypeError('Network request failed');
    },
  });
  assert.equal(resultNetworkFail, null);

  const resultHttpFail = await geocodeAddress('x', {
    token: 'pk.teste',
    fetchImpl: async () => new Response('{}', { status: 500 }),
  });
  assert.equal(resultHttpFail, null);
});

test('estoura o timeout e devolve null, respeitando o AbortSignal', async () => {
  const fetchImpl = (url, init) =>
    new Promise((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  const result = await geocodeAddress('x', { token: 'pk.teste', fetchImpl, timeoutMs: 20 });
  assert.equal(result, null);
});

test('staticMapUrl sem token devolve null', () => {
  assert.equal(staticMapUrl({ lat: -24.9555, lng: -53.4552, token: '' }), null);
});

test('staticMapUrl monta a URL com o pino na ordem lng,lat e a cor da marca', () => {
  const url = staticMapUrl({ lat: -24.9555, lng: -53.4552, token: 'pk.teste' });
  assert.match(url ?? '', /^https:\/\/api\.mapbox\.com\/styles\/v1\/mapbox\/streets-v12\/static\//);
  assert.match(url ?? '', /pin-s\+f05219\(-53\.4552,-24\.9555\)/);
  assert.match(url ?? '', /\/-53\.4552,-24\.9555,15,0\/400x160@2x/);
  assert.match(url ?? '', /access_token=pk\.teste/);
});

test('staticMapUrl aceita width/height/zoom customizados', () => {
  const url = staticMapUrl({ lat: 1, lng: 2, token: 'pk.teste', width: 200, height: 100, zoom: 10 });
  assert.match(url ?? '', /\/2,1,10,0\/200x100@2x/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test services/mapbox.test.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `./mapbox.ts`.

- [ ] **Step 3: Implementar `services/mapbox.ts`**

```ts
/** Mapbox geocoding + Static Images URL: pure, fetch/timeout/token injectable so it runs under plain Node.
 * Unlike services/supabase.ts, a missing token here never throws — the map is an enhancement, not a
 * requirement: without it, geocodeAddress and staticMapUrl just return null/undefined and callers fall
 * back to what the app already does without Mapbox. */

export type Coordinates = { lat: number; lng: number };

const DEFAULT_TIMEOUT_MS = 8000;
/** COLORS.orange from components/ui/theme.ts, without the '#' the Mapbox pin marker syntax expects. */
const PIN_COLOR = 'f05219';

export function getMapboxToken(): string | undefined {
  return process.env.EXPO_PUBLIC_MAPBOX_TOKEN || undefined;
}

type GeocodeResponse = { features?: { geometry?: { coordinates?: [number, number] } }[] };

export async function geocodeAddress(
  query: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; token?: string } = {},
): Promise<Coordinates | null> {
  const token = options.token ?? getMapboxToken();
  if (!token) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&country=br&limit=1&access_token=${encodeURIComponent(token)}`;

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return null;

    const data = (await response.json()) as GeocodeResponse;
    // GeoJSON order is [longitude, latitude] — swapped here on purpose, don't "simplify" this back.
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (!coordinates) return null;
    const [lng, lat] = coordinates;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function staticMapUrl(params: {
  lat: number;
  lng: number;
  width?: number;
  height?: number;
  zoom?: number;
  token?: string;
}): string | null {
  const token = params.token ?? getMapboxToken();
  if (!token) return null;

  const { lat, lng, width = 400, height = 160, zoom = 15 } = params;
  const pin = `pin-s+${PIN_COLOR}(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test services/mapbox.test.mjs`
Expected: 8/8 PASS.

- [ ] **Step 5: Checkpoint**

Run: `npm test` → tudo passa. `npx tsc --noEmit` limpo.

---

### Task 3: Integrar CEP e mapa em `app/new-address.tsx`

**Files:**
- Modify: `app/new-address.tsx`

**Interfaces:**
- Consumes: `lookupCep` (Task 1), `geocodeAddress`/`staticMapUrl` (Task 2), `CASCAVEL_CENTER` (já existe em `contexts/addresses-context.tsx`).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Adicionar os imports e o estado de CEP/mapa**

No topo do arquivo, junto dos imports existentes:

```tsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { AuthTextField } from '@/components/auth/auth-text-field';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScreenHeader } from '@/components/ui/screen-header';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, RADIUS, SPACING } from '@/components/ui/theme';
import { CASCAVEL_CENTER, useAddresses, type AddressTag } from '@/contexts/addresses-context';
import { geocodeAddress, staticMapUrl } from '@/services/mapbox';
import { lookupCep } from '@/services/viacep';
import { maskCep } from '@/utils/masks';
import { isValidCep } from '@/utils/validation';
```

(`useEffect` some à primeira linha; `ActivityIndicator` e `Image` são novos.)

Dentro do componente, depois dos `useState` já existentes, adicionar:

```tsx
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'network_error'>('idle');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    editingAddress ? { lat: editingAddress.lat, lng: editingAddress.lng } : null,
  );
```

- [ ] **Step 2: Efeito de busca de CEP (debounce + cancelamento)**

Logo depois do bloco de `useState`, antes de `handleSave`:

```tsx
  // Looks up the CEP 400ms after typing stops, and drops the response if the field changed meanwhile
  // (fast edits shouldn't let an older lookup overwrite what's on screen now).
  useEffect(() => {
    if (editingAddress) return; // don't fight an address that's just been loaded for editing
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) {
      setCepStatus('idle');
      return;
    }

    let cancelled = false;
    setCepStatus('loading');
    const timer = setTimeout(async () => {
      const result = await lookupCep(cep);
      if (cancelled) return;

      if (result.status === 'found') {
        setStreet(result.address.street);
        setNeighborhood(result.address.neighborhood);
        setCity(`${result.address.city}${result.address.state ? ` - ${result.address.state}` : ''}`);
        clearError('cep');
        setCepStatus('idle');
      } else if (result.status === 'not_found') {
        setErrors((current) => ({ ...current, cep: 'CEP não encontrado.' }));
        setCepStatus('idle');
      } else if (result.status === 'network_error') {
        setCepStatus('network_error');
      } else {
        setCepStatus('idle');
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep]);
```

- [ ] **Step 3: Efeito de geocodificação de prévia (atualiza o pino do mapa)**

Logo depois do efeito acima:

```tsx
  // Best-effort preview pin: re-geocodes whenever there's enough of an address to try, but never blocks
  // typing or saving — geocodeAddress already returns null on any failure (see services/mapbox.ts).
  useEffect(() => {
    if (!street.trim() || !city.trim()) return;
    let cancelled = false;
    const query = `${street}, ${number}, ${city}`.trim();
    const timer = setTimeout(async () => {
      const result = await geocodeAddress(query);
      if (!cancelled && result) setPin(result);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [street, number, city]);
```

- [ ] **Step 4: Trocar o placeholder decorativo pelo mapa real (com fallback)**

Substituir o bloco:

```tsx
      <View style={styles.mapPlaceholder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.mapGrid}>
          {[0, 1, 2, 3, 4, 5].map((tile) => (
            <View key={tile} style={[styles.mapTile, tile === 1 && styles.mapTileHighlight]} />
          ))}
        </View>
        <View style={styles.mapPin}>
          <IconSymbol name="location.fill" size={16} color={COLORS.onDark} />
        </View>
      </View>
```

por:

```tsx
      <View style={styles.mapPlaceholder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {pin ? (
          // staticMapUrl returns null without a Mapbox token; `pin` only gets a value from a successful
          // geocode, so this branch and a null URL can't happen together in the same render in practice,
          // but the fallback below still covers it if it ever does.
          <Image
            source={{ uri: staticMapUrl({ lat: pin.lat, lng: pin.lng, height: 160 }) ?? undefined }}
            style={styles.mapImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.mapGrid}>
            {[0, 1, 2, 3, 4, 5].map((tile) => (
              <View key={tile} style={[styles.mapTile, tile === 1 && styles.mapTileHighlight]} />
            ))}
          </View>
        )}
        <View style={styles.mapPin}>
          <IconSymbol name="location.fill" size={16} color={COLORS.onDark} />
        </View>
      </View>
```

E no `StyleSheet.create`, logo após `mapGrid`, adicionar:

```tsx
  mapImage: {
    ...StyleSheet.absoluteFillObject,
  },
```

- [ ] **Step 5: Indicar carregamento/erro de rede no campo CEP**

No `AuthTextField` do CEP, adicionar a prop `hint` computada a partir de `cepStatus` (sem mexer no componente `AuthTextField`, que já suporta `hint`):

```tsx
      <AuthTextField
        label="CEP"
        icon="location.fill"
        keyboardType="number-pad"
        autoComplete="postal-code"
        textContentType="postalCode"
        value={cep}
        onChangeText={(value) => {
          setCep(maskCep(value));
          clearError('cep');
        }}
        placeholder="00000-000"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => streetRef.current?.focus()}
        error={errors.cep}
        hint={
          cepStatus === 'loading'
            ? 'Buscando endereço...'
            : cepStatus === 'network_error'
              ? 'Não foi possível buscar o CEP. Preencha o endereço manualmente.'
              : undefined
        }
      />
```

(Se `errors.cep` estiver preenchido, `AuthTextField` já prioriza o erro sobre o hint — nenhuma mudança necessária no componente.)

- [ ] **Step 6: Geocodificar no salvar, mantendo o fallback atual como rede de segurança**

Trocar `handleSave` de `const`/função síncrona para `async`, e a linha do fallback:

```tsx
  const handleSave = async () => {
    const nextErrors: FieldErrors = {};
    if (cep && !isValidCep(cep)) nextErrors.cep = 'CEP incompleto.';
    if (!street.trim()) nextErrors.street = 'Informe a rua.';
    if (!number.trim()) nextErrors.number = 'Informe o número.';
    if (tag === 'outro' && !customLabel.trim()) nextErrors.label = 'Dê um nome ao endereço, ex: "Casa da mãe".';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Best-effort geocode of the final address; any failure (no token, offline, no match) falls back to
    // exactly what this screen already did before Mapbox existed.
    const geocoded = await geocodeAddress(`${street}, ${number}, ${city}`.trim());
    const { lat, lng } = geocoded ?? editingAddress ?? CASCAVEL_CENTER;
    const input = {
```

(o restante do corpo de `handleSave` continua igual; só a declaração da função e a linha do fallback mudam.)

E no JSX, o footer já chama `onPress={handleSave}` — `Button.onPress` aceita `() => void`, e uma `async () => void` é compatível (a Promise não é aguardada pelo botão, o que é aceitável aqui pois não há estado de "salvando" nesta tela hoje — mesma UX de antes, só que agora com uma pequena espera de rede antes de `router.back()`).

- [ ] **Step 7: Typecheck e lint**

Run: `npx tsc --noEmit` e `npx expo lint`
Expected: sem erros. Se o lint reclamar da linha `// eslint-disable-next-line react-hooks/exhaustive-deps` do Step 2, manter — é intencional (só `cep` deve disparar a busca, não as funções de estado).

- [ ] **Step 8: Checkpoint**

`npm test`, `npx tsc --noEmit`, `npx expo lint` limpos. Sem token de Mapbox configurado ainda (Task 9 é do usuário), a tela deve continuar idêntica visualmente ao placeholder de hoje — confirmar lendo o resultado do Step 7.

---

### Task 4: Migration do banco — `avatar_url` e bucket de Storage

**Files:**
- Aplicar (via MCP): migration `add_profiles_avatar_and_storage`

**Interfaces:**
- Consumes: tabela `public.profiles` (já existe).
- Produces: coluna `public.profiles.avatar_url`; bucket `avatars` (público) com políticas de escrita por dono.

- [ ] **Step 1: Conferir o estado atual antes de migrar**

`mcp__supabase__execute_sql`:

```sql
select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_url';
select id, public from storage.buckets where id = 'avatars';
```

Expected: as duas consultas vazias (coluna e bucket ainda não existem).

- [ ] **Step 2: Aplicar a migration**

`mcp__supabase__apply_migration`, `project_id: "grvhxufpbvgvgurjaavb"`, `name: "add_profiles_avatar_and_storage"`:

```sql
alter table public.profiles add column avatar_url text;

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
```

Expected: `{"success":true}`.

- [ ] **Step 3: Checkpoint**

`mcp__supabase__execute_sql`: `select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_url';` → 1 linha. `select id, public from storage.buckets where id='avatars';` → `avatars, true`.

---

### Task 5: Verificar RLS do bucket `avatars`

**Files:** nenhum (só SQL via MCP).

**Interfaces:**
- Consumes: políticas da Task 4.
- Produces: confiança de que a Task 8 (upload real) não vai vazar escrita entre usuários.

- [ ] **Step 1: Simular dois usuários gravando no bucket**

`mcp__supabase__execute_sql`:

```sql
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  f text[] := '{}';
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (a, 'firestok-teste-avatar-a@example.com', '{"name":"Avatar A"}'),
    (b, 'firestok-teste-avatar-b@example.com', '{"name":"Avatar B"}');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- A grava no próprio caminho
  insert into storage.objects (bucket_id, name, owner) values ('avatars', a::text || '/avatar.jpg', a);

  -- A tenta gravar no caminho de B
  begin
    insert into storage.objects (bucket_id, name, owner) values ('avatars', b::text || '/avatar.jpg', a);
    f := f || 'A gravou no caminho de B';
  exception when insufficient_privilege then null; end;

  -- A atualiza o próprio arquivo (upsert)
  update storage.objects set metadata = '{}'::jsonb where bucket_id='avatars' and name = a::text || '/avatar.jpg';

  reset role;
  raise exception 'RESULTADO: %', case when cardinality(f) = 0 then 'TUDO_OK' else array_to_string(f, ' | ') end;
end $$;
```

Expected: erro `RESULTADO: TUDO_OK`. Se aparecer `FALHA`/"A gravou no caminho de B", corrigir a policy `avatars_insert_own` com nova migration.

- [ ] **Step 2: Checkpoint**

Nenhum dado de teste persiste (o `raise exception` no fim desfaz tudo). Sem commit.

---

### Task 6: Instalar `expo-image-picker` e configurar permissões

**Files:**
- Modify: `package.json`, `app.json`

**Interfaces:**
- Consumes: nada.
- Produces: `expo-image-picker` disponível para a Task 8.

- [ ] **Step 1: Instalar a dependência**

Run: `npx expo install expo-image-picker`
Expected: entra em `dependencies` de `package.json` com versão compatível com Expo 57.

- [ ] **Step 2: Registrar o plugin com os textos de permissão**

Em `app.json`, dentro de `"plugins": [...]`, adicionar (mantendo os plugins existentes):

```json
      [
        "expo-image-picker",
        {
          "photosPermission": "O FireStock usa a galeria para você escolher sua foto de perfil.",
          "cameraPermission": "O FireStock usa a câmera para você tirar sua foto de perfil."
        }
      ],
```

- [ ] **Step 3: Checkpoint**

Run: `npx tsc --noEmit` (sem mudança esperada) e `npx expo lint`. `grep -n "expo-image-picker" package.json app.json` mostra as duas entradas.

---

### Task 7: `services/profile.ts` (TDD) e ligação em `services/supabase.ts`

**Files:**
- Create: `services/profile.ts`
- Test: `services/profile.test.mjs`
- Modify: `services/supabase.ts`

**Interfaces:**
- Consumes: `supabase` (client real, de `services/supabase.ts`).
- Produces (usado nas Tasks 8/9): `export function avatarStoragePath(userId: string, contentType: string): string`; `export function withCacheBust(url: string, at?: number): string`; `export type ProfileClientLike = {...}`; `export function createProfileService(client: ProfileClientLike, options?: { fetchImpl?: typeof fetch }): { updateAvatar(userId: string, file: { uri: string; contentType: string }): Promise<string>; getMyProfile(userId: string): Promise<{ avatarUrl: string | null }> }`. `services/supabase.ts` passa a exportar `export const profileService = createProfileService(supabase);`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `services/profile.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { avatarStoragePath, createProfileService, withCacheBust } from './profile.ts';

test('avatarStoragePath monta {uid}/avatar.{ext} a partir do content-type', () => {
  assert.equal(avatarStoragePath('user-1', 'image/jpeg'), 'user-1/avatar.jpg');
  assert.equal(avatarStoragePath('user-1', 'image/png'), 'user-1/avatar.png');
  assert.equal(avatarStoragePath('user-1', 'image/webp'), 'user-1/avatar.webp');
});

test('avatarStoragePath rejeita content-type desconhecido com mensagem clara', () => {
  assert.throws(() => avatarStoragePath('user-1', 'application/pdf'), /tipo de imagem não suportado/i);
});

test('withCacheBust adiciona ?v= com o timestamp informado', () => {
  assert.equal(withCacheBust('https://x.test/avatars/user-1/avatar.jpg', 1700000000000), 'https://x.test/avatars/user-1/avatar.jpg?v=1700000000000');
});

test('withCacheBust troca o v= se a URL já tiver query string', () => {
  assert.equal(withCacheBust('https://x.test/a.jpg?foo=1', 42), 'https://x.test/a.jpg?foo=1&v=42');
});

function fakeClient(methods = {}) {
  const unexpected = (name) => async () => {
    throw new Error(`${name} não era esperado`);
  };
  return {
    storage: {
      from: (bucket) => ({
        upload: methods.upload ?? unexpected('storage.upload'),
        getPublicUrl: methods.getPublicUrl ?? (() => ({ data: { publicUrl: `https://cdn.test/${bucket}` } })),
      }),
    },
    from: (table) => ({
      update: methods.update ?? unexpected('from.update'),
      select: methods.select ?? unexpected('from.select'),
    }),
  };
}

test('updateAvatar sobe o blob no caminho certo, com upsert, e grava avatar_url em profiles', async () => {
  let uploadArgs;
  let updateArgs;
  const service = createProfileService(
    fakeClient({
      upload: async (path, body, options) => {
        uploadArgs = { path, body, options };
        return { data: { path }, error: null };
      },
      getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.test/avatars/user-1/avatar.jpg' } }),
      update: (values) => ({
        eq: async (column, value) => {
          updateArgs = { values, column, value };
          return { error: null };
        },
      }),
    }),
    { fetchImpl: async () => ({ blob: async () => 'FAKE_BLOB' }) },
  );

  const url = await service.updateAvatar('user-1', { uri: 'file:///tmp/foto.jpg', contentType: 'image/jpeg' });

  assert.equal(uploadArgs.path, 'user-1/avatar.jpg');
  assert.equal(uploadArgs.body, 'FAKE_BLOB');
  assert.deepEqual(uploadArgs.options, { contentType: 'image/jpeg', upsert: true });
  assert.deepEqual(updateArgs, { values: { avatar_url: url }, column: 'id', value: 'user-1' });
  assert.match(url, /^https:\/\/cdn\.test\/avatars\/user-1\/avatar\.jpg\?v=\d+$/);
});

test('updateAvatar propaga erro de upload com mensagem em pt-BR', async () => {
  const service = createProfileService(
    fakeClient({ upload: async () => ({ data: null, error: { message: 'storage full' } }) }),
    { fetchImpl: async () => ({ blob: async () => 'FAKE_BLOB' }) },
  );
  await assert.rejects(
    service.updateAvatar('user-1', { uri: 'file:///x.jpg', contentType: 'image/jpeg' }),
    /não foi possível salvar a foto/i,
  );
});

test('updateAvatar propaga erro ao gravar avatar_url em profiles', async () => {
  const service = createProfileService(
    fakeClient({
      upload: async () => ({ data: { path: 'user-1/avatar.jpg' }, error: null }),
      update: () => ({ eq: async () => ({ error: { message: 'db down' } }) }),
    }),
    { fetchImpl: async () => ({ blob: async () => 'FAKE_BLOB' }) },
  );
  await assert.rejects(
    service.updateAvatar('user-1', { uri: 'file:///x.jpg', contentType: 'image/jpeg' }),
    /não foi possível salvar a foto/i,
  );
});

test('getMyProfile devolve avatarUrl da tabela profiles', async () => {
  const service = createProfileService(
    fakeClient({
      select: () => ({ eq: () => ({ single: async () => ({ data: { avatar_url: 'https://cdn.test/x.jpg' }, error: null }) }) }),
    }),
  );
  assert.deepEqual(await service.getMyProfile('user-1'), { avatarUrl: 'https://cdn.test/x.jpg' });
});

test('getMyProfile nunca rejeita: erro ou avatar_url nulo viram avatarUrl: null', async () => {
  const withError = createProfileService(
    fakeClient({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'not found' } }) }) }) }),
  );
  assert.deepEqual(await withError.getMyProfile('user-1'), { avatarUrl: null });

  const nullAvatar = createProfileService(
    fakeClient({ select: () => ({ eq: () => ({ single: async () => ({ data: { avatar_url: null }, error: null }) }) }) }),
  );
  assert.deepEqual(await nullAvatar.getMyProfile('user-1'), { avatarUrl: null });

  const throwing = createProfileService(
    fakeClient({ select: () => ({ eq: () => ({ single: async () => { throw new Error('boom'); } }) }) }),
  );
  assert.deepEqual(await throwing.getMyProfile('user-1'), { avatarUrl: null });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test services/profile.test.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `./profile.ts`.

- [ ] **Step 3: Implementar `services/profile.ts`**

```ts
/** Avatar upload + profile read: the Supabase client is injected (like auth-core.ts's createAuthService),
 * so this file runs under plain Node. The Storage/DB calls here aren't unit-testable without a real
 * Supabase — only the pure helpers (path building, cache-busting) and the shape of the calls are. */

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** "{uid}/avatar.{ext}" — every upload for a user overwrites this same path, so there's never more than
 * one file per user to clean up. */
export function avatarStoragePath(userId: string, contentType: string): string {
  const ext = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!ext) throw new Error(`Tipo de imagem não suportado: ${contentType}`);
  return `${userId}/avatar.${ext}`;
}

/** Appends (or refreshes) a cache-busting query param, so a new photo doesn't keep showing the old one
 * from the image cache at the same public URL. */
export function withCacheBust(url: string, at: number = Date.now()): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${at}`;
}

type StorageUploadResult = { data: { path: string } | null; error: { message: string } | null };

export type ProfileClientLike = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: unknown,
        options: { contentType: string; upsert: boolean },
      ): Promise<StorageUploadResult>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
  from(table: string): {
    update(values: Record<string, unknown>): { eq(column: string, value: string): Promise<{ error: { message: string } | null }> };
    select(columns: string): {
      eq(column: string, value: string): { single(): Promise<{ data: { avatar_url: string | null } | null; error: { message: string } | null }> };
    };
  };
};

const AVATAR_BUCKET = 'avatars';
const SAVE_FAILED_MESSAGE = 'Não foi possível salvar a foto. Tente novamente.';

export function createProfileService(client: ProfileClientLike, options: { fetchImpl?: typeof fetch } = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function updateAvatar(userId: string, file: { uri: string; contentType: string }): Promise<string> {
    const path = avatarStoragePath(userId, file.contentType);
    const body = await (await fetchImpl(file.uri)).blob();

    const { error: uploadError } = await client.storage
      .from(AVATAR_BUCKET)
      .upload(path, body, { contentType: file.contentType, upsert: true });
    if (uploadError) throw new Error(SAVE_FAILED_MESSAGE);

    const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = withCacheBust(data.publicUrl);

    const { error: updateError } = await client.from('profiles').update({ avatar_url: url }).eq('id', userId);
    if (updateError) throw new Error(SAVE_FAILED_MESSAGE);

    return url;
  }

  /** Never rejects: any failure (row missing, network, malformed data) just means "no photo yet". */
  async function getMyProfile(userId: string): Promise<{ avatarUrl: string | null }> {
    try {
      const { data, error } = await client.from('profiles').select('avatar_url').eq('id', userId).single();
      if (error || !data) return { avatarUrl: null };
      return { avatarUrl: data.avatar_url ?? null };
    } catch {
      return { avatarUrl: null };
    }
  }

  return { updateAvatar, getMyProfile };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test services/profile.test.mjs`
Expected: 10/10 PASS.

- [ ] **Step 5: Ligar ao client real em `services/supabase.ts`**

Adicionar ao fim de `services/supabase.ts`:

```ts
import { createProfileService } from './profile';

export const profileService = createProfileService(supabase);
```

(A importação de `createProfileService` some para o topo do arquivo, junto dos demais imports, seguindo a convenção do arquivo.)

- [ ] **Step 6: Checkpoint**

Run: `npm test`, `npx tsc --noEmit`. Ambos limpos.

---

### Task 8: Contexto de perfil ganha `userId`/`avatarUrl` e busca após login/restauração

**Files:**
- Modify: `contexts/profile-context.tsx`, `app/login.tsx`, `app/register.tsx`

**Interfaces:**
- Consumes: `profileService.getMyProfile` (Task 7), `restoreSession`/`AuthResponse` (já existem, `AuthResponse.user.id` já é devolvido por `services/auth-core.ts`).
- Produces (usado na Task 9 e 10): `useProfile()` passa a expor `userId: string`, `setUserId: (id: string) => void`, `avatarUrl: string | null` e `setAvatarUrl: (url: string | null) => void`.

- [ ] **Step 1: Adicionar `userId`/`avatarUrl` ao contexto e buscar o perfil ao restaurar a sessão**

Em `contexts/profile-context.tsx`, adicionar ao import:

```tsx
import { profileService } from '@/services/supabase';
```

No tipo `ProfileContextValue`, depois de `isRestoringSession: boolean;`:

```tsx
  userId: string;
  avatarUrl: string | null;
  setUserId: (id: string) => void;
  setAvatarUrl: (url: string | null) => void;
```

No corpo de `ProfileProvider`, depois de `const [isRestoringSession, setIsRestoringSession] = useState(true);`:

```tsx
  const [userId, setUserId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
```

Dentro do `useEffect` existente, no `.then` de `restoreSession()`, depois de `setToken(session.token);`:

```tsx
        setUserId(session.user.id);
        // Best-effort: a failed/slow profile fetch never blocks the auth restore itself.
        profileService.getMyProfile(session.user.id).then(({ avatarUrl }) => {
          if (active) setAvatarUrl(avatarUrl);
        });
```

No branch `SIGNED_OUT` do `onAuthStateChange`, junto de `setToken('');`, adicionar `setUserId('');` e `setAvatarUrl(null);`.

E no `value={{ ... }}` do Provider, adicionar `userId, avatarUrl, setUserId, setAvatarUrl,` junto dos demais campos.

- [ ] **Step 2: Preencher `userId` logo após um login bem-sucedido**

Em `app/login.tsx`, na desestruturação de `useProfile()`, adicionar `setUserId`. No `try` de `handleLogin`, junto de `setToken(response.token);`, adicionar `setUserId(response.user.id);` — sem isso, `userId` só ficaria disponível depois de reabrir o app (quando `restoreSession` roda), nunca logo após um login novo.

- [ ] **Step 3: Preencher `userId` logo após um cadastro bem-sucedido**

Mesma mudança em `app/register.tsx`: adicionar `setUserId` à desestruturação de `useProfile()`, e `setUserId(response.user.id);` junto de `setToken(response.token);` no `try` de `handleRegister`.

- [ ] **Step 4: Checkpoint**

Run: `npx tsc --noEmit`. `Grep` por `setUserId` no projeto deve mostrar as chamadas em `profile-context.tsx`, `login.tsx` e `register.tsx`.

---

### Task 9: Trocar a foto em `app/account.tsx`

**Files:**
- Modify: `app/account.tsx`

**Interfaces:**
- Consumes: `userId`/`avatarUrl`/`setAvatarUrl` (Task 8), `profileService.updateAvatar` (Task 7), `errorMessage` (já existe em `@/services/auth`), `ImagePicker` (Task 6).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Imports**

```tsx
import * as ImagePicker from 'expo-image-picker';

import { errorMessage } from '@/services/auth';
import { profileService } from '@/services/supabase';
```

- [ ] **Step 2: Estado local e função de troca de foto**

No corpo de `AccountScreen`, na desestruturação de `useProfile()` já existente (linhas 39-53), adicionar `userId`, `avatarUrl` e `setAvatarUrl` à lista de campos lidos (sem remover nenhum dos já usados: `name`, `email`, `phone`, `cpf`, `birthDate`, `memberSince`, `setName`, `setEmail`, `setPhone`, `setCpf`, `setBirthDate`, `setIsAuthenticated`, `setToken`).

Depois de `const [errors, setErrors] = useState<FieldErrors>({});`:

```tsx
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const pickAndUploadAvatar = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso para escolher a foto de perfil.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';

    // Optimistic: show the new photo right away, revert only if the upload actually fails.
    setPreviewUri(asset.uri);
    setIsUploadingAvatar(true);
    try {
      const url = await profileService.updateAvatar(userId, { uri: asset.uri, contentType });
      setAvatarUrl(url);
      setPreviewUri(null);
    } catch (error) {
      setPreviewUri(null);
      Alert.alert('Não foi possível atualizar a foto', errorMessage(error));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangeAvatar = () => {
    Alert.alert('Foto de perfil', undefined, [
      { text: 'Câmera', onPress: () => pickAndUploadAvatar('camera') },
      { text: 'Galeria', onPress: () => pickAndUploadAvatar('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };
```

- [ ] **Step 3: Exibir a foto (ou prévia) no avatar, com toque para trocar**

Substituir:

```tsx
      <View style={styles.avatarSection}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.avatarText}>{initials(draftName) || '?'}</Text>
        </View>
        <Text style={styles.avatarName}>{draftName.trim() || 'Visitante'}</Text>
        <Text style={styles.avatarSubtitle}>{memberSinceLabel(memberSince)}</Text>
      </View>
```

por:

```tsx
      <View style={styles.avatarSection}>
        <PressableScale
          onPress={handleChangeAvatar}
          disabled={isUploadingAvatar}
          accessibilityRole="button"
          accessibilityLabel="Trocar foto de perfil">
          <View style={styles.avatar}>
            {previewUri || avatarUrl ? (
              <Image
                source={{ uri: previewUri ?? avatarUrl ?? undefined }}
                style={styles.avatarImage}
                contentFit="cover"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            ) : (
              <Text style={styles.avatarText} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {initials(draftName) || '?'}
              </Text>
            )}
            {isUploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={COLORS.onDark} />
              </View>
            ) : null}
          </View>
          <View style={styles.avatarEditBadge}>
            <IconSymbol name="camera.fill" size={14} color={COLORS.onDark} />
          </View>
        </PressableScale>
        <Text style={styles.avatarName}>{draftName.trim() || 'Visitante'}</Text>
        <Text style={styles.avatarSubtitle}>{memberSinceLabel(memberSince)}</Text>
      </View>
```

Adicionar os imports que faltam no topo do arquivo: `ActivityIndicator` (de `react-native`) e `Image` (de `expo-image`).

No `StyleSheet.create`, logo após o bloco `avatar: {...}` existente, adicionar (mantendo `avatar` como está, só acrescentando `overflow: 'hidden'` a ele para a imagem respeitar o círculo):

```tsx
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

(substitui a antiga declaração de `avatar` no `StyleSheet.create`, sem duplicar a chave.)

- [ ] **Step 4: Typecheck e lint**

Run: `npx tsc --noEmit` e `npx expo lint`
Expected: sem erros.

- [ ] **Step 5: Checkpoint**

`npm test` (nenhum teste novo aqui, mas a suíte inteira continua passando), `npx tsc --noEmit`, `npx expo lint` limpos.

---

### Task 10: Exibir a foto em `app/(tabs)/profile.tsx`

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `avatarUrl` (Task 8).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Import e leitura do contexto**

Adicionar ao import de `expo-image`: `import { Image } from 'expo-image';` (novo import, no topo do arquivo). Na desestruturação de `useProfile()`:

```tsx
  const { name, email, avatarUrl, setName, setEmail, setToken, setIsAuthenticated } = useProfile();
```

- [ ] **Step 2: Mostrar a foto no lugar das iniciais**

Substituir:

```tsx
            <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.avatarText}>{initials(name) || '?'}</Text>
            </View>
```

por:

```tsx
            <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials(name) || '?'}</Text>
              )}
            </View>
```

No `StyleSheet.create`, no bloco `avatar: {...}` já existente, acrescentar `overflow: 'hidden',`, e logo depois adicionar:

```tsx
  avatarImage: {
    width: '100%',
    height: '100%',
  },
```

- [ ] **Step 3: Typecheck e lint**

Run: `npx tsc --noEmit` e `npx expo lint`
Expected: sem erros.

- [ ] **Step 4: Checkpoint**

`npm test`, `npx tsc --noEmit`, `npx expo lint` limpos.

---

### Task 11: Variáveis de ambiente do Mapbox e verificação final

**Files:**
- Modify: `.env.example`, `.env.local`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: app pronto para uso, com relatório final.

- [ ] **Step 1: Documentar a variável do Mapbox**

Em `.env.example`, adicionar ao final:

```
# Mapbox (mapbox.com → Account → Access tokens). Opcional: sem ele, o endereço continua salvável, só
# sem o mapa real (fica no placeholder).
EXPO_PUBLIC_MAPBOX_TOKEN=pk.xxxxxxxx
```

Em `.env.local`, adicionar (comentado, o usuário preenche depois):

```
# EXPO_PUBLIC_MAPBOX_TOKEN=
```

- [ ] **Step 2: Suíte completa**

Run: `npm test` → todos os testes (os já existentes + os novos de `viacep`, `mapbox`, `profile`) passam.
Run: `npx tsc --noEmit` → limpo.
Run: `npx expo lint` → limpo.

- [ ] **Step 3: Busca por regressão**

`Grep` por `API_BASE_URL` e por `server/` em todo o projeto (fora de `node_modules`) → zero resultados (garante que nada da limpeza do MongoDB foi reintroduzido).

- [ ] **Step 4: Advisors do Supabase**

`mcp__supabase__get_advisors` (`security` e depois `performance`) → sem alertas novos causados por este trabalho (a coluna `avatar_url` e o bucket `avatars`).

- [ ] **Step 5: Pedir ao usuário o token do Mapbox e reiniciar o Expo**

Sem o token, o app já está funcional (CEP preenche, endereço salva, foto sobe e persiste) — só falta o mapa real aparecer. Pedir ao usuário: colar o `EXPO_PUBLIC_MAPBOX_TOKEN` real em `.env.local` e rodar `npx expo start -c`. Não fazer isso sozinho — mesma regra usada para o `.env.local` do Supabase.

- [ ] **Step 6: Checkpoint final**

Critérios do spec §1: (1) CEP válido preenche o formulário, CEP inexistente/incompleto/rede tratados ✔ Task 3; (2) mapa real com fallback ✔ Tasks 2 e 3 (visualmente pendente do token do usuário); (3) foto salva no Storage/`profiles` e recuperada após reload/login ✔ Tasks 4, 7, 8, 9, 10; (4) nada que já funcionava regride ✔ Steps 2-3 aqui; (5) `tsc`/lint/test limpos ✔ Step 2. Sem commit, salvo se o usuário pedir.
