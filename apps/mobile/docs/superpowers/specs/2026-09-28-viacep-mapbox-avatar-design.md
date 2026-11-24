# FireStock — CEP real, mapa real e foto de perfil persistida

Data: 2026-09-28
Status: aguardando revisão do spec

## 1. Objetivo

Implementar do zero, no FireStock, três recursos que **não existem hoje**: busca de endereço por CEP (ViaCEP), mapa real na tela de novo endereço (Mapbox), e upload/persistência de foto de perfil (Supabase Storage + `profiles`).

### Estado atual confirmado (antes de qualquer mudança)
- **ViaCEP:** não existe nenhuma chamada. O campo CEP em `app/new-address.tsx` é texto livre, só validado quanto ao formato (`isValidCep`, `utils/validation.ts:40`).
- **Mapbox:** não existe. O "mapa" em `app/new-address.tsx:91-100` é um `View` decorativo com blocos coloridos fixos. O comentário no código já diz: *"No geocoding service wired up yet"*. Sem token, sem lib de mapa no `package.json`.
- **Foto de perfil:** não existe. O avatar em `app/(tabs)/profile.tsx` e `app/account.tsx` é só as iniciais do nome (`utils/format.ts`). Sem `expo-image-picker`, sem coluna de foto em `profiles`, sem bucket de Storage.
- Endereços são 100% locais (`contexts/addresses-context.tsx`, estado em memória) — não são persistidos no Supabase. Isso está fora de escopo tanto antes quanto depois deste trabalho.

### Critério de sucesso
1. Digitar um CEP válido em "Novo endereço" preenche rua, bairro e cidade automaticamente; CEP inexistente, incompleto ou com falha de rede mostra o erro certo e nunca trava o formulário.
2. A tela de novo/editar endereço mostra um mapa real (Mapbox Static Images) centralizado no endereço, com fallback gracioso (placeholder atual) quando não há coordenadas.
3. Trocar a foto de perfil (câmera ou galeria) salva a imagem no Supabase Storage e a URL em `profiles.avatar_url`; a foto aparece corretamente depois de recarregar o app ou logar de novo, em `account.tsx` e `app/(tabs)/profile.tsx`.
4. Nenhuma funcionalidade hoje funcional regride: sem token/CEP/Mapbox configurado, ou sem rede, o formulário de endereço continua salvável do jeito que é hoje.
5. `npx tsc --noEmit`, `npx expo lint` e `npm test` limpos.

### Fora de escopo
- Persistir endereços no Supabase (continuam só no contexto local).
- Editar CEP/rua manualmente disparar geocodificação a cada tecla (só no blur/CEP resolvido/salvar, para não estourar limites de API).
- Mapa interativo (arrastar/zoom) — decidido usar a Static Images API, compatível com Expo Go; um mapa interativo de verdade (`@rnmapbox/maps`) exigiria sair do Expo Go (prebuild + dev client), o que muda o fluxo de desenvolvimento do projeto inteiro e não foi pedido.
- Remover fotos antigas do Storage após várias trocas (cada usuário sempre sobrescreve o mesmo arquivo — não há acúmulo a limpar).
- Recorte/zoom da foto antes do upload.

## 2. Por que ViaCEP e Mapbox são complementares, não redundantes

ViaCEP converte CEP → campos estruturados de endereço (rua/bairro/cidade/estado), com a base dos Correios, sem token. Mapbox converte um endereço em texto → coordenadas, para desenhar o mapa; sua cobertura de CEP brasileiro isolado é menos precisa no nível de rua. Usar só Mapbox para preencher o formulário pioraria a precisão do autopreenchimento e tornaria essa função (que hoje não depende de nada externo) dependente de um token de terceiro. Por isso o preenchimento do formulário usa ViaCEP (sem token, sempre disponível) e o mapa usa Mapbox (opcional, degrada graciosamente).

## 3. Decisões já aprovadas pelo usuário

- Mapa: **Mapbox Static Images API** (sem dependência nativa nova, compatível com Expo Go), não `@rnmapbox/maps`.
- Token do Mapbox: o usuário ainda vai criar a conta gratuita em mapbox.com e colar em `.env.local`; o código trata a ausência do token sem quebrar nada.
- Origem da foto: **galeria + câmera** (menu de escolha).
- Bucket do Storage: **público** (URL direta, sem link assinado); escrita restrita ao próprio dono via RLS de `storage.objects`.

## 4. Subsistema A — CEP real (ViaCEP)

### `services/viacep.ts` (novo)
Módulo puro, no padrão de `services/auth-core.ts` (sem import de React Native, `fetch` injetável, testável no Node):

```ts
export type ViaCepAddress = { street: string; neighborhood: string; city: string; state: string };
export type ViaCepResult =
  | { status: 'found'; address: ViaCepAddress }
  | { status: 'not_found' }
  | { status: 'invalid_format' }
  | { status: 'network_error' };

export async function lookupCep(cep: string, fetchImpl: typeof fetch = fetch): Promise<ViaCepResult>;
```

- CEP com menos de 8 dígitos → `invalid_format`, sem chamar a rede.
- `GET https://viacep.com.br/ws/{8 dígitos}/json/`. Resposta `{"erro": true}` → `not_found`. Resposta válida → mapeia `logradouro→street`, `bairro→neighborhood`, `localidade→city`, `uf→state`.
- `fetch` rejeita, resposta não-OK, corpo não é JSON válido, ou timeout (8 s, mesmo padrão de `AbortController` usado em `services/auth-core.ts`) → `network_error`.
- CORS: ViaCEP já envia `Access-Control-Allow-Origin: *`, então funciona também no `web` (verificado como parte da implementação; se algum ambiente específico bloquear, o `network_error` já cobre o caso sem quebrar o formulário).

### Integração em `app/new-address.tsx`
- Ao `cep` atingir 8 dígitos (via `maskCep`), dispara `lookupCep` (debounce simples: só dispara quando o valor parar de mudar por 400 ms, e cancela buscas anteriores).
- `found` → preenche `street`, `neighborhood`, `city` (nunca `number`/`complement`), limpa erro do campo CEP.
- `not_found` → erro no campo: "CEP não encontrado.".
- `invalid_format` → mantém a validação/mensagem que já existe hoje ("CEP incompleto.") — sem mudança de comportamento aqui.
- `network_error` → não bloqueia; um aviso discreto (texto de ajuda abaixo do campo, não um Alert) diz "Não foi possível buscar o CEP. Preencha manualmente."; a pessoa preenche os campos à mão, exatamente como o formulário permite hoje.
- Enquanto a busca está em andamento, mostra um `ActivityIndicator` pequeno dentro do campo (reaproveitando o mesmo campo `AuthTextField`, sem novo componente).

## 5. Subsistema B — Mapa real (Mapbox)

### `services/mapbox.ts` (novo)
Módulo puro, mesmo padrão:

```ts
export type Coordinates = { lat: number; lng: number };

export function getMapboxToken(): string | undefined; // process.env.EXPO_PUBLIC_MAPBOX_TOKEN
export async function geocodeAddress(query: string, fetchImpl?: typeof fetch): Promise<Coordinates | null>;
export function staticMapUrl(params: { lat: number; lng: number; width?: number; height?: number; zoom?: number }): string | null;
```

- Sem token (`getMapboxToken()` vazio) → `geocodeAddress` devolve `null` e `staticMapUrl` devolve `null` **sem chamar a rede nem lançar erro** — diferente de `services/supabase.ts`, que é obrigatório; o Mapbox é opcional.
- `geocodeAddress`: `GET https://api.mapbox.com/search/geocode/v6/forward?q={query}&country=br&limit=1&access_token={token}`. Sem `features` ou erro de rede/timeout (8 s) → `null`. **Atenção à ordem**: `features[0].geometry.coordinates` vem como `[longitude, latitude]` (GeoJSON) — o código extrai `lng = coordinates[0]`, `lat = coordinates[1]`.
- `staticMapUrl`: monta `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+f05219({lng},{lat})/{lng},{lat},{zoom},0/{width}x{height}@2x?access_token={token}` (cor do pino `f05219` = `COLORS.orange` do tema, mesma cor do pino decorativo atual). Padrão: `width=400,height=160,zoom=15` (mesma proporção do placeholder atual, `height:160`).

### Integração em `app/new-address.tsx`
- Depois que o CEP resolve (ou quando rua+cidade mudam manualmente, no blur do campo Cidade), geocodifica `${street}, ${number}, ${city}` (sem `number` se ainda vazio) e guarda `{lat,lng}` em estado local.
- O placeholder vira condicional: **com coordenadas e token**, renderiza `<Image source={{uri: staticMapUrl(...)}} style={estilo atual do placeholder} contentFit="cover" />` (mesmo padrão `expo-image` já usado em todo o app) com o mesmo `borderRadius`/`height` de hoje — visualmente no mesmo lugar, mesmo tamanho. **Sem coordenadas ou sem token**, mantém exatamente o `View` decorativo atual — nenhuma mudança de layout para quem não configurou Mapbox.
- Em `handleSave`: tenta geocodificar o endereço completo (rua+número+cidade) antes de montar `input`; sucesso → usa essas coordenadas; qualquer falha (sem token, sem rede, sem resultado) → cai no fallback **já existente** `editingAddress ?? CASCAVEL_CENTER`. O comportamento de hoje não é removido, vira a rede de segurança.

### Variáveis de ambiente
- `.env.example`: adiciona `EXPO_PUBLIC_MAPBOX_TOKEN=pk.xxxxxxxx` (comentário explicando que é opcional).
- `.env.local`: adiciona a chave **vazia/comentada** (o usuário ainda vai gerar o token); o app funciona sem ela, só sem mapa real.

## 6. Subsistema C — Foto de perfil

### Banco (migration `add_profiles_avatar_and_storage`, aplicada via MCP)
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
Leitura: o bucket é público, então `GET` por URL funciona sem policy de `SELECT` (Storage do Supabase libera download de bucket público sem checar RLS). Caminho do arquivo: `{uid}/avatar.{ext}` — cada usuário sempre sobrescreve o próprio arquivo (`upsert: true`), nunca acumula.

### `services/profile.ts` (novo)
```ts
export type ProfileClientLike = { storage: {...}; from(table: 'profiles'): {...} }; // fatia do SupabaseClient usada aqui

export function avatarStoragePath(userId: string, contentType: string): string; // "{uid}/avatar.{ext}", extensão pura de content-type→ext (testável sem rede)
export function withCacheBust(url: string, at?: number): string; // "url?v=<timestamp>" (testável)

export function createProfileService(client: ProfileClientLike) {
  return {
    async updateAvatar(userId: string, file: { uri: string; contentType: string }): Promise<string>; // faz upload + update profiles.avatar_url + devolve URL com cache-bust
    async getMyProfile(userId: string): Promise<{ avatarUrl: string | null }>; // nunca rejeita: erro vira { avatarUrl: null }
  };
}
```
- `avatarStoragePath` e `withCacheBust` são funções puras, cobertas por teste direto.
- `updateAvatar`/`getMyProfile` são testados só na parte que não é rede (a forma como chamam o client), com um client falso injetado — mesmo padrão de `auth-core.test.mjs`.
- `services/supabase.ts` ganha só a exportação do client já existente sendo reaproveitado (`createProfileService(supabase)`), sem duplicar configuração.

### `contexts/profile-context.tsx`
- Novo estado `avatarUrl: string | null` e `setAvatarUrl`.
- Depois que `restoreSession()` resolve com sessão válida (e depois de login/cadastro bem-sucedidos), chama `getMyProfile(userId)` e preenche `avatarUrl`. Igual ao resto do contexto: se essa busca falhar, não bloqueia nada — só fica sem foto (mostra iniciais).

### `app/account.tsx`
- Toque no círculo do avatar abre `Alert.alert('Foto de perfil', undefined, [{text:'Câmera',...}, {text:'Galeria',...}, {text:'Cancelar', style:'cancel'}])` — mesmo padrão de diálogo já usado para sair/excluir conta nesta tela.
- Pede permissão (`expo-image-picker`), abre câmera ou galeria, recebe o URI local.
- Mostra a prévia local **na hora** (estado local `pendingAvatarUri`), chama `updateAvatar(userId, {uri, contentType})`; sucesso → `setAvatarUrl` no contexto e limpa a prévia local; erro → reverte a prévia e mostra `Alert.alert('Não foi possível atualizar a foto', errorMessage(error))` (reaproveita `errorMessage`, hoje só usado no fluxo de auth — passa a ser um helper genérico de erro, sem duplicar lógica).
- Um pequeno ícone de câmera (`camera.fill`, já existe no `IconSymbol`) sobreposto no canto do avatar indica que é tocável — sem criar componente novo de UI, reaproveitando `IconSymbol` e `PressableScale` já usados no arquivo.

### `app/(tabs)/profile.tsx`
- Mostra a foto (`<Image source={{uri: avatarUrl}} .../>`) no lugar das iniciais quando `avatarUrl` existe; senão, mantém as iniciais exatamente como hoje. **Sem** botão de trocar foto aqui — só a tela de conta edita, mesma divisão de responsabilidade que já existe para nome/telefone/CPF.

### Nova dependência
`expo-image-picker`, instalada via `npx expo install expo-image-picker` (mesmo processo usado para `@supabase/supabase-js`). Necessária — escolher/tirar foto não é possível sem ela; não duplica nenhuma lib já presente.

## 7. Testes

- `services/viacep.test.mjs`: CEP válido (mock de resposta), CEP incompleto (sem chamar fetch), `{erro:true}`, falha de rede, timeout.
- `services/mapbox.test.mjs`: sem token (não chama fetch), geocodificação com resultado, sem resultado, erro de rede; montagem de `staticMapUrl` (ordem lng/lat correta, parâmetros na URL); sem token, `staticMapUrl` devolve `null`.
- `services/profile.test.mjs`: `avatarStoragePath` (extensões `image/jpeg→jpg`, `image/png→png`, tipo desconhecido→erro claro), `withCacheBust` (adiciona `?v=`, não duplica se já tiver query string), `updateAvatar`/`getMyProfile` com client falso (sucesso, erro de upload, erro de update, sessão sem usuário).
- Todos entram no `npm test` existente (glob `services/**/*.test.mjs`, sem mudar o script).
- RLS do bucket `avatars`: verificado por SQL via MCP, mesmo estilo da migração anterior — usuário A não consegue gravar em `{uid-de-B}/avatar.jpg`, só no próprio caminho.
- `npx tsc --noEmit`, `npx expo lint` limpos ao final.

## 8. Pré-requisito manual do usuário

Criar uma conta gratuita em mapbox.com, gerar um "Access token" (o "Default public token" serve) e colar em `EXPO_PUBLIC_MAPBOX_TOKEN` no `.env.local`, depois reiniciar o Expo (`npx expo start -c`). Sem isso, o app funciona normalmente (CEP preenche o formulário, endereço salva com a coordenada padrão de Cascavel), só não mostra o mapa real.

## 9. Riscos e decisões registradas

- **Precisão do CEP→coordenada:** o endereço pode não bater exatamente com o pino do mapa (a geocodificação do Mapbox pode não achar o número exato). Aceitável — é só uma prévia visual, igual a qualquer app que usa geocoding de terceiro.
- **Limite de requisições do Mapbox:** free tier tem limite mensal; o app não deve geocodificar a cada tecla (debounce + só no blur/salvar) para não estourar. Se estourar, `geocodeAddress` devolve `null` (erro de rede/HTTP) e cai no fallback, sem quebrar o app.
- **Bucket público:** qualquer pessoa com a URL da foto consegue vê-la (decisão já aprovada) — igual à prática comum de avatar de app.
- **`profiles.avatar_url` não sincroniza automaticamente com nada além do upload manual** — coerente com o resto do `profiles`, que hoje só é populado no cadastro (nome/e-mail) e não é atualizado pelas telas de edição existentes (fora de escopo mexer nisso agora).
