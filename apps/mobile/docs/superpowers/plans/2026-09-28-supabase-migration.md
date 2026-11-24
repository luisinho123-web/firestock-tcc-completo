# Migração para o Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o schema do FireStock no Supabase (organização FireStok), integrar cadastro/login/sessão do app ao Supabase Auth e remover por completo o MongoDB (código, dependências, docs e processos em execução).

**Architecture:** O app fala direto com o Supabase via `@supabase/supabase-js` (Supabase Auth + tabela `profiles` criada por trigger). A lógica de auth fica em um módulo puro e testável (`services/auth-core.ts`) que recebe o cliente por injeção; `services/auth.ts` só liga esse módulo ao cliente real e mantém a API pública que as telas já usam. O servidor Express deixa de existir. Toda a proteção de dados fica em RLS + triggers no Postgres.

**Tech Stack:** Supabase (Postgres 17, Auth, RLS, MCP `mcp__supabase__*`), `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, Expo 57 / React Native 0.86, TypeScript, `node --test` (Node 26, com type stripping nativo).

**Spec:** `docs/superpowers/specs/2026-09-28-supabase-migration-design.md`

## Global Constraints

- Projeto Supabase: `grvhxufpbvgvgurjaavb` (`Fenando2018's Project`, org FireStok `ypacwauubxeuwuqofvuw`, us-east-1). Não criar outro projeto.
- **Nenhum commit.** O repositório não tem commits e o git enxerga `Documents` como raiz. Cada task termina num "Checkpoint" (verificação), não em `git commit`.
- Apenas a chave **publishable** vai para o app (`.env.local`, já ignorado por `.env*.local`). **Nunca** usar nem gravar a `service_role`.
- RLS ativada em **todas** as tabelas do schema `public`. Valores monetários em centavos (`integer`).
- `discount_percent` entre 20 e 90 (RN002); `quantity >= 0` (RN003); `expires_at > created_at` (RN001); medicamentos e suplementos fora das categorias (RN010).
- Nunca armazenar número completo de cartão, CVV nem dados sensíveis de cartão (`payment_methods` guarda só bandeira, tipo, titular, `last4`, validade).
- O usuário **não** pode alterar `role`, `suspended_until`, `lgpd_consent_at` nem `email` do próprio perfil, nem `status`/`approved_*`/`rating_*`/`owner_id` de parceiros.
- Funções auxiliares e de trigger ficam no schema `private` (não exposto pela API REST); nada `SECURITY DEFINER` no schema `public`.
- `services/auth.ts` mantém exportados `registerUser`, `loginUser`, `ApiError`, `errorMessage` e o tipo `AuthResponse` (`{ message, token, user: { id, name, email } }`, `token` = `access_token`). Status HTTP mapeados: e-mail já cadastrado → 409; credenciais inválidas → 401; sem rede/timeout (15 s) → 0.
- Textos voltados ao usuário em português (pt-BR).
- **Não** parar, reiniciar nem alterar o Expo (porta 8081). Se ele precisar ser reiniciado para ler o `.env.local`, pedir ao usuário.
- **Não** desinstalar o MongoDB do Windows nem apagar a pasta de dados dele. Só parar o processo `mongod` em execução.
- Nunca usar `pkill`/kill por nome: parar processos somente pelo PID, depois de reconferir que a porta ainda pertence ao processo esperado.
- Os usuários de teste têm e-mail `firestok-teste-*@example.com` e devem ser removidos ao final (Task 7).

## Pré-requisito do usuário (antes da Task 3)

Desligar **Confirm email** no painel do Supabase: Authentication → Providers → Email → desativar "Confirm email". O MCP não altera essa configuração. Sem isso, `signUp` não devolve sessão e as verificações de RLS (Task 3) e do app (Task 7) não funcionam.

## Review Focus

Entradas e condições que o spec sugere mas nenhum teste óbvio cobriria; cada linha tem o teste na task dona:

1. **E-mail já cadastrado** — com "Confirm email" desligado o Supabase devolve erro; ligado, devolve um usuário sem `identities`. Nos dois casos o usuário deve ver "Este e-mail já está cadastrado." (409), nunca um falso sucesso. → Task 4 (testes de `registerUser`).
2. **"Confirm email" ainda ligado** — `signUp` sem sessão deve virar erro claro (403), não entrar no app sem token. → Task 4.
3. **Sessão guardada inválida/expirada ao abrir o app** — `restoreSession` deve devolver `null` (nunca lançar), e o app cai no onboarding em vez de travar em tela vazia. → Task 4 (teste) e Task 5 (`isRestoringSession` sempre termina).
4. **Nome em branco ou com acentos no cadastro** — o trigger nunca pode falhar (senão o cadastro inteiro falha): nome vazio cai no prefixo do e-mail; acentos/emoji são preservados. → Task 2.
5. **Escalada de privilégio pela API REST** — usuário comum tentando virar `admin`, aprovar o próprio parceiro, ler perfil alheio ou gravar em `reservations`/endereço de outro usuário. → Task 3.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `services/auth-core.ts` (novo) | Lógica pura de auth: `ApiError`, `errorMessage`, `mapAuthError`, `createAuthService(client)`. Sem imports de React Native, testável no Node. |
| `services/auth-core.test.mjs` (novo) | Testes do módulo acima com cliente falso. |
| `services/supabase.ts` (novo) | Cria o cliente Supabase (env vars, AsyncStorage, auto-refresh). |
| `services/auth.ts` (reescrito) | Liga `createAuthService` ao cliente real; reexporta a API pública. |
| `contexts/profile-context.tsx` (alterado) | Restaura a sessão ao abrir o app e reage a `SIGNED_OUT`/`TOKEN_REFRESHED`. |
| `app/index.tsx` (alterado) | Espera a restauração da sessão antes de redirecionar. |
| `app/(tabs)/profile.tsx`, `app/account.tsx` (alterados) | Logout / "excluir conta" também encerram a sessão no Supabase. |
| `.env.local` (novo, ignorado), `.env.example` (novo) | Variáveis do Supabase. |
| `package.json` (alterado) | Deps novas; remove deps e scripts do MongoDB. |
| `server/`, docs `2026-09-23-mongodb-*` (removidos) | Fim do MongoDB. |
| `FireStock-PRD.md`, `FireStock-tasks.md` (alterados) | Refletem a decisão de arquitetura. |

Migrations do banco (aplicadas via MCP `apply_migration`, nesta ordem): `create_firestock_tables`, `create_private_helpers_and_triggers`, `enable_rls_and_policies`, `create_indexes_and_seed_categories`.

---

### Task 1: Tabelas, índices e seed no Supabase

**Files:**
- Aplicar (via MCP): migrations `create_firestock_tables` e `create_indexes_and_seed_categories`

**Interfaces:**
- Consumes: nada.
- Produces: tabelas `public.profiles`, `partners`, `categories`, `products`, `reservations`, `reservation_items`, `reviews`, `notifications`, `favorites`, `addresses`, `payment_methods`; enums `user_role`, `partner_status`, `product_status`, `reservation_status`. Colunas exatamente como abaixo (as Tasks 2 e 3 dependem delas).

- [ ] **Step 1: Carregar as ferramentas do MCP e conferir o estado atual**

Usar `ToolSearch` com `select:mcp__supabase__apply_migration,mcp__supabase__execute_sql,mcp__supabase__get_advisors,mcp__supabase__get_project_url,mcp__supabase__get_publishable_keys,mcp__supabase__list_migrations` numa única chamada. Depois chamar `mcp__supabase__list_tables` com `project_id: "grvhxufpbvgvgurjaavb"`, `schemas: ["public"]`, `verbose: false`.
Expected: `{"tables":[]}`. Se já houver tabelas, PARAR e perguntar ao usuário antes de continuar.

- [ ] **Step 2: Aplicar a migration `create_firestock_tables`**

Chamar `mcp__supabase__apply_migration` com `project_id: "grvhxufpbvgvgurjaavb"`, `name: "create_firestock_tables"` e este SQL:

```sql
create type public.user_role as enum ('consumer', 'partner', 'admin');
create type public.partner_status as enum ('pending', 'approved', 'rejected');
create type public.product_status as enum ('active', 'expired', 'removed');
create type public.reservation_status as enum ('pending', 'confirmed', 'picked_up', 'cancelled', 'expired', 'no_show');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  email text not null,
  cpf text,
  phone text,
  birth_date date,
  role public.user_role not null default 'consumer',
  suspended_until timestamptz,
  lgpd_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_cpf_key on public.profiles (cpf) where cpf is not null;

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  legal_name text not null,
  trade_name text not null,
  cnpj text not null unique check (cnpj ~ '^\d{14}$'),
  category text,
  phone text,
  email text,
  cep text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  lat double precision,
  lng double precision,
  opening_hours jsonb,
  bank_code text,
  bank_agency text,
  bank_account text,
  status public.partner_status not null default 'pending',
  rejection_reason text,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  rating_avg numeric(3, 2),
  rating_count integer not null default 0 check (rating_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id),
  category_id uuid references public.categories (id),
  name text not null,
  description text,
  image_url text,
  barcode text,
  original_price_cents integer not null check (original_price_cents > 0),
  discount_percent integer not null check (discount_percent between 20 and 90),
  price_cents integer generated always as (original_price_cents * (100 - discount_percent) / 100) stored,
  quantity integer not null check (quantity >= 0),
  expires_at timestamptz not null,
  status public.product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.profiles (id),
  partner_id uuid not null references public.partners (id),
  pickup_code text not null unique,
  status public.reservation_status not null default 'pending',
  total_cents integer not null check (total_cents >= 0),
  pickup_deadline timestamptz,
  cancelled_at timestamptz,
  picked_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations (id),
  consumer_id uuid not null references public.profiles (id),
  partner_id uuid not null references public.partners (id),
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  category text not null check (category in ('pedidos', 'promocoes', 'conta')),
  title text not null,
  message text not null,
  reservation_id uuid references public.reservations (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  tag text not null check (tag in ('casa', 'trabalho', 'outro')),
  cep text,
  street text not null,
  number text,
  complement text,
  neighborhood text,
  city text,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('pix', 'dinheiro', 'cartao')),
  brand text,
  kind text check (kind in ('credito', 'debito')),
  holder_name text,
  last4 text,
  expiry text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    type <> 'cartao'
    or (
      brand is not null
      and kind is not null
      and holder_name is not null
      and last4 ~ '^\d{4}$'
      and expiry ~ '^(0[1-9]|1[0-2])/\d{2}$'
    )
  )
);
```

Expected: `{"success":true}`.

- [ ] **Step 3: Aplicar a migration `create_indexes_and_seed_categories`**

Chamar `mcp__supabase__apply_migration` com `name: "create_indexes_and_seed_categories"` e:

```sql
create index partners_owner_id_idx on public.partners (owner_id);
create index partners_approved_by_idx on public.partners (approved_by);
create index partners_status_idx on public.partners (status);
create index products_partner_id_idx on public.products (partner_id);
create index products_category_id_idx on public.products (category_id);
create index products_status_expires_at_idx on public.products (status, expires_at);
create index reservations_consumer_id_idx on public.reservations (consumer_id);
create index reservations_partner_id_idx on public.reservations (partner_id);
create index reservation_items_reservation_id_idx on public.reservation_items (reservation_id);
create index reservation_items_product_id_idx on public.reservation_items (product_id);
create index reviews_consumer_id_idx on public.reviews (consumer_id);
create index reviews_partner_id_idx on public.reviews (partner_id);
create index notifications_user_id_read_at_idx on public.notifications (user_id, read_at);
create index notifications_reservation_id_idx on public.notifications (reservation_id);
create index favorites_product_id_idx on public.favorites (product_id);
create index addresses_user_id_idx on public.addresses (user_id);
create index payment_methods_user_id_idx on public.payment_methods (user_id);

insert into public.categories (slug, name) values
  ('mercearia', 'Mercearia'),
  ('padaria', 'Padaria'),
  ('laticinios', 'Laticínios'),
  ('carnes-e-frios', 'Carnes e Frios'),
  ('hortifruti', 'Hortifruti'),
  ('bebidas', 'Bebidas'),
  ('congelados', 'Congelados'),
  ('higiene', 'Higiene'),
  ('limpeza', 'Limpeza'),
  ('pet', 'Pet');
```

Expected: `{"success":true}`.

- [ ] **Step 4: Verificar tabelas, constraints e seed**

Chamar `mcp__supabase__list_tables` (`schemas: ["public"]`, `verbose: false`). Expected: 11 tabelas (`profiles`, `partners`, `categories`, `products`, `reservations`, `reservation_items`, `reviews`, `notifications`, `favorites`, `addresses`, `payment_methods`).

Depois `mcp__supabase__execute_sql`:

```sql
select
  (select count(*) from public.categories) as categorias,
  (select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'price_cents') as coluna_gerada,
  (select is_generated from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'price_cents') as gerada;
```

Expected: `categorias = 10`, `coluna_gerada = price_cents`, `gerada = ALWAYS`.

- [ ] **Step 5: Provar que as regras de negócio do banco rejeitam dados inválidos**

`mcp__supabase__execute_sql` (tudo dentro de um bloco que desfaz o que fizer):

```sql
do $$
declare
  uid uuid := gen_random_uuid();
  pid uuid := gen_random_uuid();
  ok boolean;
begin
  insert into auth.users (id, email) values (uid, 'firestok-teste-constraints@example.com');
  -- (o trigger de perfil só existe na Task 2; aqui criamos o perfil na mão)
  insert into public.profiles (id, full_name, email) values (uid, 'Teste', 'firestok-teste-constraints@example.com');
  insert into public.partners (id, owner_id, legal_name, trade_name, cnpj)
    values (pid, uid, 'Teste LTDA', 'Teste', '12345678000199');

  -- desconto 19% e 91% devem falhar; 20% e 90% devem passar
  ok := false; begin insert into public.products (partner_id, name, original_price_cents, discount_percent, quantity, expires_at)
    values (pid, 'x', 1000, 19, 1, now() + interval '1 day'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'FALHA: desconto 19%% aceito'; end if;

  ok := false; begin insert into public.products (partner_id, name, original_price_cents, discount_percent, quantity, expires_at)
    values (pid, 'x', 1000, 91, 1, now() + interval '1 day'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'FALHA: desconto 91%% aceito'; end if;

  -- validade no passado deve falhar
  ok := false; begin insert into public.products (partner_id, name, original_price_cents, discount_percent, quantity, expires_at)
    values (pid, 'x', 1000, 50, 1, now() - interval '1 day'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'FALHA: validade passada aceita'; end if;

  -- estoque negativo deve falhar
  ok := false; begin insert into public.products (partner_id, name, original_price_cents, discount_percent, quantity, expires_at)
    values (pid, 'x', 1000, 50, -1, now() + interval '1 day'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'FALHA: estoque negativo aceito'; end if;

  -- 20%% e 90%% passam e o preço final é calculado
  insert into public.products (partner_id, name, original_price_cents, discount_percent, quantity, expires_at)
    values (pid, 'ok20', 1000, 20, 1, now() + interval '1 day'), (pid, 'ok90', 1000, 90, 0, now() + interval '1 day');
  if (select price_cents from public.products where name = 'ok20') <> 800
     or (select price_cents from public.products where name = 'ok90') <> 100 then
    raise exception 'FALHA: price_cents calculado errado';
  end if;

  -- cartão sem last4 deve falhar
  ok := false; begin insert into public.payment_methods (user_id, type, brand, kind, holder_name, expiry)
    values (uid, 'cartao', 'visa', 'credito', 'TESTE', '11/27'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'FALHA: cartão sem last4 aceito'; end if;

  raise exception 'TUDO_OK_ROLLBACK';  -- desfaz tudo de propósito
end $$;
```

Expected: o erro `TUDO_OK_ROLLBACK` (qualquer outra mensagem `FALHA: ...` é bug do schema: corrigir com nova migration e repetir). Depois conferir que nada ficou: `select count(*) from auth.users where email like 'firestok-teste-%'` → `0`.

- [ ] **Step 6: Checkpoint**

`mcp__supabase__list_migrations` deve listar `create_firestock_tables` e `create_indexes_and_seed_categories`. Não há commit.

---

### Task 2: Schema `private`, trigger de perfil e proteção de colunas

**Files:**
- Aplicar (via MCP): migration `create_private_helpers_and_triggers`

**Interfaces:**
- Consumes: tabelas da Task 1.
- Produces: `private.is_admin() returns boolean` (executável só por `authenticated`); trigger `on_auth_user_created` em `auth.users` que cria `public.profiles`; triggers `set_updated_at` (6 tabelas) e `protect_profile_columns` / `protect_partner_columns` (bloqueiam alteração de colunas sensíveis por `anon`/`authenticated` não-admin).

- [ ] **Step 1: Aplicar a migration `create_private_helpers_and_triggers`**

`mcp__supabase__apply_migration`, `name: "create_private_helpers_and_triggers"`:

```sql
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário'
    ),
    coalesce(new.email, '')
  );
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not (select private.is_admin()) then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.email is distinct from old.email
       or new.suspended_until is distinct from old.suspended_until
       or new.lgpd_consent_at is distinct from old.lgpd_consent_at then
      raise exception 'Alteração não permitida.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function private.protect_profile_columns();

create function private.protect_partner_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not (select private.is_admin()) then
    if new.id is distinct from old.id
       or new.owner_id is distinct from old.owner_id
       or new.status is distinct from old.status
       or new.rejection_reason is distinct from old.rejection_reason
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.rating_avg is distinct from old.rating_avg
       or new.rating_count is distinct from old.rating_count then
      raise exception 'Alteração não permitida.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_partner_columns
  before update on public.partners
  for each row execute function private.protect_partner_columns();

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.partners
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.reservations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.addresses
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.payment_methods
  for each row execute function private.set_updated_at();
```

Expected: `{"success":true}`.

Observação (diferença em relação ao spec §4): a proteção de colunas usa triggers, a alternativa prevista no spec §9, em vez de `REVOKE UPDATE` por coluna — porque o admin também precisa alterar `partners.status`, e privilégio de coluna vale para todo o papel `authenticated`. A checagem usa `current_user` (e não `auth.uid()`) para que futuras funções `SECURITY DEFINER` (que rodam como `postgres`) consigam atualizar `rating_*` sem serem bloqueadas.

- [ ] **Step 2: Verificar que o trigger de perfil funciona (nome normal, nome em branco, acentos)**

`mcp__supabase__execute_sql`:

```sql
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (a, 'firestok-teste-t2a@example.com', '{"name":"Maria Souza"}'),
    (b, 'firestok-teste-t2b@example.com', '{"name":"   "}'),
    (c, 'firestok-teste-t2c@example.com', '{"name":"José Ávila 🍞"}'),
    (d, 'firestok-teste-t2d@example.com', '{}');

  if (select full_name from public.profiles where id = a) <> 'Maria Souza' then raise exception 'FALHA: nome normal'; end if;
  if (select full_name from public.profiles where id = b) <> 'firestok-teste-t2b' then raise exception 'FALHA: nome em branco deveria cair no prefixo do e-mail'; end if;
  if (select full_name from public.profiles where id = c) <> 'José Ávila 🍞' then raise exception 'FALHA: acentos/emoji'; end if;
  if (select full_name from public.profiles where id = d) <> 'firestok-teste-t2d' then raise exception 'FALHA: sem metadata'; end if;
  if (select count(*) from public.profiles where id in (a, b, c, d) and role = 'consumer') <> 4 then raise exception 'FALHA: role padrão'; end if;

  raise exception 'TUDO_OK_ROLLBACK';
end $$;
```

Expected: erro `TUDO_OK_ROLLBACK`. Se aparecer `FALHA: ...`, corrigir `private.handle_new_user` com nova migration e repetir.

- [ ] **Step 3: Verificar o cadastro real pela API do Auth (o caminho que o app usa)**

Obter URL e chave: `mcp__supabase__get_project_url` e `mcp__supabase__get_publishable_keys` (usar a chave `sb_publishable_...`; se só houver a legacy `anon`, usar essa). Numa chamada Bash, com os valores obtidos:

```bash
URL="<url do projeto>"; KEY="<publishable key>"
curl -s -X POST "$URL/auth/v1/signup" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"firestok-teste-a@example.com","password":"Teste@12345","data":{"name":"Teste A"}}'
```

Expected: JSON com `"id"` do usuário (com "Confirm email" ligado vem sem `access_token`; desligado vem com). Se vier erro de e-mail inválido para `example.com`, trocar o domínio de teste para outro domínio reservado e ajustar o padrão `firestok-teste-%` nas limpezas.

Depois `mcp__supabase__execute_sql`:

```sql
select p.full_name, p.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'firestok-teste-a@example.com';
```

Expected: 1 linha: `Teste A | firestok-teste-a@example.com | consumer`. Se a linha não existir, o cadastro pela API provavelmente falhou por permissão do trigger (`supabase_auth_admin` sem EXECUTE): ver `mcp__supabase__query_logs` (service `auth` e `postgres`) e, se for isso, conceder `grant execute on function private.handle_new_user() to supabase_auth_admin;` (e `grant usage on schema private to supabase_auth_admin;`) numa nova migration.

- [ ] **Step 4: Checkpoint**

O usuário `firestok-teste-a@example.com` fica para as Tasks 3 e 7 (removido na Task 7). Não há commit.

---

### Task 3: RLS e políticas de acesso + verificação pela API REST

**Files:**
- Aplicar (via MCP): migration `enable_rls_and_policies`
- Criar (fora do repositório, no scratchpad da sessão): `rls-check.sh`

**Interfaces:**
- Consumes: tabelas (Task 1), `private.is_admin()` e triggers de proteção (Task 2), usuário `firestok-teste-a@example.com`.
- Produces: RLS ativa nas 11 tabelas; políticas conforme spec §4.

- [ ] **Step 1: Confirmar o pré-requisito do usuário**

Confirmar que o usuário desligou "Confirm email" (ver "Pré-requisito do usuário"). Teste rápido: o `signup` de um usuário novo (`firestok-teste-b@example.com`, Step 4) deve devolver `access_token`. Se não devolver, pedir ao usuário para desligar a opção e aguardar.

- [ ] **Step 2: Aplicar a migration `enable_rls_and_policies`**

`mcp__supabase__apply_migration`, `name: "enable_rls_and_policies"`:

```sql
alter table public.profiles enable row level security;
alter table public.partners enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.favorites enable row level security;
alter table public.addresses enable row level security;
alter table public.payment_methods enable row level security;

-- profiles: cada um vê/edita o seu; admin vê todos. Colunas sensíveis protegidas por trigger.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- partners: aprovados são públicos; dono vê/edita o seu; admin gerencia.
create policy partners_select_anon on public.partners for select to anon
  using (status = 'approved');
create policy partners_select_auth on public.partners for select to authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or (select private.is_admin()));
create policy partners_insert_own on public.partners for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and rejection_reason is null
    and approved_at is null
    and approved_by is null
    and rating_avg is null
    and rating_count = 0
  );
create policy partners_update on public.partners for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_admin()));

-- categories: leitura pública; escrita só admin.
create policy categories_select on public.categories for select to anon, authenticated
  using (true);
create policy categories_insert_admin on public.categories for insert to authenticated
  with check ((select private.is_admin()));
create policy categories_update_admin on public.categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_delete_admin on public.categories for delete to authenticated
  using ((select private.is_admin()));

-- products: públicos se ativos, não vencidos e de parceiro aprovado; dono (aprovado) e admin gerenciam.
create policy products_select_anon on public.products for select to anon
  using (
    status = 'active'
    and expires_at > now()
    and exists (select 1 from public.partners p where p.id = products.partner_id and p.status = 'approved')
  );
create policy products_select_auth on public.products for select to authenticated
  using (
    (
      status = 'active'
      and expires_at > now()
      and exists (select 1 from public.partners p where p.id = products.partner_id and p.status = 'approved')
    )
    or exists (select 1 from public.partners p where p.id = products.partner_id and p.owner_id = (select auth.uid()))
    or (select private.is_admin())
  );
create policy products_insert on public.products for insert to authenticated
  with check (
    exists (
      select 1 from public.partners p
      where p.id = products.partner_id and p.owner_id = (select auth.uid()) and p.status = 'approved'
    )
    or (select private.is_admin())
  );
create policy products_update on public.products for update to authenticated
  using (
    exists (
      select 1 from public.partners p
      where p.id = products.partner_id and p.owner_id = (select auth.uid()) and p.status = 'approved'
    )
    or (select private.is_admin())
  )
  with check (
    exists (
      select 1 from public.partners p
      where p.id = products.partner_id and p.owner_id = (select auth.uid()) and p.status = 'approved'
    )
    or (select private.is_admin())
  );
create policy products_delete on public.products for delete to authenticated
  using (
    exists (
      select 1 from public.partners p
      where p.id = products.partner_id and p.owner_id = (select auth.uid()) and p.status = 'approved'
    )
    or (select private.is_admin())
  );

-- reservations / reservation_items: leitura por consumidor, dono do parceiro e admin. Sem escrita direta
-- nesta etapa (será feita por funções de negócio futuras).
create policy reservations_select on public.reservations for select to authenticated
  using (
    consumer_id = (select auth.uid())
    or exists (select 1 from public.partners p where p.id = reservations.partner_id and p.owner_id = (select auth.uid()))
    or (select private.is_admin())
  );
create policy reservation_items_select on public.reservation_items for select to authenticated
  using (exists (select 1 from public.reservations r where r.id = reservation_items.reservation_id));

-- reviews: leitura pública; consumidor cria a sua só para reserva sua já retirada.
create policy reviews_select on public.reviews for select to anon, authenticated
  using (true);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    consumer_id = (select auth.uid())
    and exists (
      select 1 from public.reservations r
      where r.id = reviews.reservation_id
        and r.consumer_id = (select auth.uid())
        and r.partner_id = reviews.partner_id
        and r.status = 'picked_up'
    )
  );

-- dados privados do usuário: acesso total apenas ao próprio user_id.
create policy notifications_own on public.notifications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy addresses_own on public.addresses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy payment_methods_own on public.payment_methods for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
```

Expected: `{"success":true}`.

- [ ] **Step 3: Confirmar RLS ativa em tudo**

`mcp__supabase__execute_sql`:

```sql
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```

Expected: 11 linhas, todas com `relrowsecurity = true`.

- [ ] **Step 4: Escrever o script de verificação pela API REST**

Salvar como `rls-check.sh` no scratchpad da sessão (fora do repositório). Substituir `<URL>` e `<KEY>` pelos valores de `get_project_url` / `get_publishable_keys`:

```bash
#!/usr/bin/env bash
URL="<URL>"; KEY="<KEY>"; PASS="Teste@12345"
fail=0
check() { # check "descrição" "esperado (substring)" "obtido"
  if [[ "$3" == *"$2"* ]]; then echo "OK    $1"; else echo "FALHA $1 -> esperava '$2', veio: $3"; fail=1; fi
}
json() { node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(eval('j.'+process.argv[1]))" "$1"; }

# B é novo (signup); A já existe (login)
curl -s -X POST "$URL/auth/v1/signup" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"firestok-teste-b@example.com\",\"password\":\"$PASS\",\"data\":{\"name\":\"Teste B\"}}" > /dev/null || true
login() { curl -s -X POST "$URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$1\",\"password\":\"$PASS\"}"; }
A=$(login firestok-teste-a@example.com); B=$(login firestok-teste-b@example.com)
TA=$(echo "$A" | json access_token); TB=$(echo "$B" | json access_token)
UA=$(echo "$A" | json user.id);      UB=$(echo "$B" | json user.id)
[[ -z "$TA" || "$TA" == "undefined" || -z "$TB" || "$TB" == "undefined" ]] && { echo "Sem access_token: 'Confirm email' ainda está ligado?"; exit 1; }

rest() { # rest METHOD PATH TOKEN [BODY]
  curl -s -X "$1" "$URL/rest/v1/$2" -H "apikey: $KEY" ${3:+-H "Authorization: Bearer $3"} \
    -H "Content-Type: application/json" -H "Prefer: return=representation" ${4:+-d "$4"}
}

# 1. A vê só o próprio perfil
r=$(rest GET "profiles?select=id" "$TA");            check "A lista profiles -> só 1 linha" "\"$UA\"" "$r"
[[ "$r" == *"$UB"* ]] && { echo "FALHA A enxergou B"; fail=1; }
# 2. A não lê B por id
r=$(rest GET "profiles?id=eq.$UB&select=id" "$TA");  check "A lê perfil de B -> vazio" "[]" "$r"
# 3. A não vira admin
r=$(rest PATCH "profiles?id=eq.$UA" "$TA" '{"role":"admin"}'); check "A vira admin -> bloqueado" "42501" "$r"
# 4. A edita o próprio nome
r=$(rest PATCH "profiles?id=eq.$UA" "$TA" '{"full_name":"Teste A Editado"}'); check "A edita o próprio nome" "Teste A Editado" "$r"
# 5. A não grava reserva
r=$(rest POST "reservations" "$TA" "{\"consumer_id\":\"$UA\",\"partner_id\":\"00000000-0000-0000-0000-000000000000\",\"pickup_code\":\"X1\",\"total_cents\":100}"); check "A cria reserva -> bloqueado" "42501" "$r"
# 6. anon: perfis vazios, categorias visíveis, parceiros vazios
r=$(rest GET "profiles?select=id" "");               check "anon lê profiles -> vazio" "[]" "$r"
r=$(rest GET "categories?select=slug" "");           check "anon lê categories -> mercearia" "mercearia" "$r"
r=$(rest GET "partners?select=id" "");               check "anon lê partners -> vazio" "[]" "$r"
# 7. A cadastra parceiro pendente, mas não se auto-aprova
r=$(rest POST "partners" "$TA" "{\"owner_id\":\"$UA\",\"legal_name\":\"Teste LTDA\",\"trade_name\":\"Teste\",\"cnpj\":\"12345678000199\"}"); check "A cria parceiro pendente" "pending" "$r"
PID=$(echo "$r" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8'))[0].id)")
r=$(rest POST "partners" "$TA" "{\"owner_id\":\"$UA\",\"legal_name\":\"X\",\"trade_name\":\"X\",\"cnpj\":\"99999999000199\",\"status\":\"approved\"}"); check "A cria parceiro já aprovado -> bloqueado" "42501" "$r"
r=$(rest PATCH "partners?id=eq.$PID" "$TA" '{"status":"approved"}'); check "A aprova o próprio parceiro -> bloqueado" "42501" "$r"
# 8. sem aprovação, A não publica produto
r=$(rest POST "products" "$TA" "{\"partner_id\":\"$PID\",\"name\":\"Leite\",\"original_price_cents\":1000,\"discount_percent\":50,\"quantity\":1,\"expires_at\":\"2099-01-01T00:00:00Z\"}"); check "A publica produto com parceiro pendente -> bloqueado" "42501" "$r"
# 9. A não grava endereço para B
r=$(rest POST "addresses" "$TA" "{\"user_id\":\"$UB\",\"label\":\"x\",\"tag\":\"casa\",\"street\":\"Rua X\"}"); check "A grava endereço de B -> bloqueado" "42501" "$r"
r=$(rest POST "addresses" "$TA" "{\"user_id\":\"$UA\",\"label\":\"Casa\",\"tag\":\"casa\",\"street\":\"Rua A\"}"); check "A grava o próprio endereço" "Rua A" "$r"

echo; [[ $fail -eq 0 ]] && echo "TUDO OK" || echo "HÁ FALHAS"; exit $fail
```

- [ ] **Step 5: Rodar o script e ver falhar/passar**

Run: `bash <caminho do scratchpad>/rls-check.sh`
Expected: todas as linhas `OK ...` e `TUDO OK` no final. Se `A vira admin` ou `A aprova o próprio parceiro` não devolverem `42501`, o trigger de proteção (Task 2) não está atuando: conferir `current_user` no contexto do PostgREST e corrigir com nova migration. Qualquer outra `FALHA` indica política errada: corrigir com nova migration `fix_rls_*` e repetir.

- [ ] **Step 6: Confirmar no banco que nada escapou**

`mcp__supabase__execute_sql`:

```sql
select u.email, p.role, p.full_name
from public.profiles p join auth.users u on u.id = p.id
where u.email like 'firestok-teste-%'
order by u.email;
```

Expected: `firestok-teste-a` com `role = consumer` e `full_name = Teste A Editado`; `firestok-teste-b` com `consumer`.

- [ ] **Step 7: Rodar os advisors**

`mcp__supabase__get_advisors` com `type: "security"` e depois `type: "performance"`.
Expected: nenhum alerta ERROR/WARN causado por este trabalho (função sem `search_path`, tabela sem RLS, FK sem índice, `auth.uid()` sem `select`, múltiplas políticas permissivas). Corrigir tudo o que for consequência do schema com nova migration. São aceitáveis e devem ser apenas reportadas ao usuário: alertas de configuração do projeto (ex.: proteção contra senhas vazadas desativada) e INFO de índices ainda não usados.

- [ ] **Step 8: Checkpoint**

`list_migrations` mostra as 4 migrations. Os usuários de teste A e B e o parceiro/endereço de teste continuam existindo até a Task 7. Não há commit.

---

### Task 4: Módulo de auth (TDD), cliente Supabase e variáveis de ambiente

**Files:**
- Criar: `services/auth-core.ts`, `services/auth-core.test.mjs`, `services/supabase.ts`, `.env.example`, `.env.local`
- Modificar: `services/auth.ts` (reescrita), `package.json` (deps + script `test`)

**Interfaces:**
- Consumes: URL e chave publishable do projeto (`get_project_url`, `get_publishable_keys`).
- Produces (usados nas Tasks 5 e 7):
  - `services/auth-core.ts`: `class ApiError extends Error { readonly status: number }`; `errorMessage(error: unknown, fallback?: string): string`; `type AuthResponse`; `mapAuthError(error: AuthErrorLike): ApiError`; `createAuthService(client: AuthClientLike, options?: { timeoutMs?: number })` → `{ registerUser, loginUser, signOutUser, restoreSession }`.
  - `services/auth.ts`: `registerUser(data: { name: string; email: string; password: string }): Promise<AuthResponse>`, `loginUser(data: { email: string; password: string }): Promise<AuthResponse>`, `signOutUser(): Promise<void>`, `restoreSession(): Promise<AuthResponse | null>` (nunca rejeita), além de `ApiError`, `errorMessage`, `AuthResponse`.
  - `services/supabase.ts`: `export const supabase` (cliente real).

- [ ] **Step 1: Escrever os testes que falham**

Criar `services/auth-core.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError, createAuthService, errorMessage, mapAuthError } from './auth-core.ts';

const NETWORK_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';

const sessionFor = (userOverrides = {}) => ({
  access_token: 'token-123',
  user: {
    id: 'user-1',
    email: 'maria@email.com',
    user_metadata: { name: 'Maria Souza' },
    identities: [{ id: 'identity-1' }],
    ...userOverrides,
  },
});

/** Fake Supabase client: each method defaults to "must not be called". */
function fakeClient(methods = {}) {
  const unexpected = (name) => async () => {
    throw new Error(`${name} não era esperado`);
  };
  return {
    auth: {
      signUp: methods.signUp ?? unexpected('signUp'),
      signInWithPassword: methods.signInWithPassword ?? unexpected('signInWithPassword'),
      signOut: methods.signOut ?? unexpected('signOut'),
      getSession: methods.getSession ?? unexpected('getSession'),
    },
  };
}

test('mapAuthError traduz os códigos conhecidos do Supabase', () => {
  const rateLimit = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  const cases = [
    [{ code: 'user_already_exists', status: 422 }, 409, 'Este e-mail já está cadastrado.'],
    [{ code: 'email_exists', status: 422 }, 409, 'Este e-mail já está cadastrado.'],
    [{ code: 'invalid_credentials', status: 400 }, 401, 'E-mail ou senha inválidos.'],
    [{ code: 'email_not_confirmed', status: 400 }, 403, 'Confirme seu e-mail antes de entrar.'],
    [{ code: 'weak_password', status: 422 }, 422, 'A senha é muito fraca. Use pelo menos 6 caracteres.'],
    [{ code: 'over_request_rate_limit', status: 429 }, 429, rateLimit],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 429, rateLimit],
    [{ code: 'signup_disabled', status: 422 }, 403, 'Cadastros estão desativados no momento.'],
  ];

  for (const [input, status, message] of cases) {
    const error = mapAuthError(input);
    assert.ok(error instanceof ApiError, input.code);
    assert.equal(error.status, status, input.code);
    assert.equal(error.message, message, input.code);
  }
});

test('mapAuthError trata falha de rede como status 0', () => {
  const error = mapAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' });
  assert.equal(error.status, 0);
  assert.equal(error.message, NETWORK_MESSAGE);
});

test('mapAuthError não vaza mensagem interna em erros desconhecidos', () => {
  const error = mapAuthError({ message: 'relation "x" does not exist', status: 500, code: 'unexpected_failure' });
  assert.equal(error.status, 500);
  assert.equal(error.message, 'Não foi possível concluir a operação.');
  assert.equal(mapAuthError({}).status, 500);
});

test('errorMessage devolve a mensagem do erro ou o fallback', () => {
  assert.equal(errorMessage(new Error('falhou')), 'falhou');
  assert.equal(errorMessage('texto solto'), 'Tente novamente em instantes.');
  assert.equal(errorMessage(new Error(''), 'outro'), 'outro');
});

test('registerUser envia nome como metadata, preserva a senha e devolve a AuthResponse', async () => {
  let received;
  const session = sessionFor();
  const auth = createAuthService(
    fakeClient({
      signUp: async (args) => {
        received = args;
        return { data: { user: session.user, session }, error: null };
      },
    }),
  );

  const response = await auth.registerUser({ name: 'Maria Souza', email: 'maria@email.com', password: ' senha com espaço ' });

  assert.deepEqual(received, {
    email: 'maria@email.com',
    password: ' senha com espaço ',
    options: { data: { name: 'Maria Souza' } },
  });
  assert.deepEqual(response, {
    message: 'Cadastro realizado com sucesso.',
    token: 'token-123',
    user: { id: 'user-1', name: 'Maria Souza', email: 'maria@email.com' },
  });
});

test('registerUser: e-mail já cadastrado (erro do Supabase) vira 409', async () => {
  const auth = createAuthService(
    fakeClient({ signUp: async () => ({ data: { user: null, session: null }, error: { code: 'user_already_exists', status: 422 } }) }),
  );
  await assert.rejects(auth.registerUser({ name: 'A', email: 'a@a.com', password: '123456' }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    return true;
  });
});

test('registerUser: e-mail já cadastrado com confirmação ligada (usuário sem identities) vira 409', async () => {
  const obfuscated = { id: 'fake', email: 'a@a.com', user_metadata: {}, identities: [] };
  const auth = createAuthService(
    fakeClient({ signUp: async () => ({ data: { user: obfuscated, session: null }, error: null }) }),
  );
  await assert.rejects(auth.registerUser({ name: 'A', email: 'a@a.com', password: '123456' }), (error) => {
    assert.equal(error.status, 409);
    return true;
  });
});

test('registerUser: sem sessão (confirmação de e-mail ligada) é erro claro, não sucesso', async () => {
  const user = sessionFor().user;
  const auth = createAuthService(
    fakeClient({ signUp: async () => ({ data: { user, session: null }, error: null }) }),
  );
  await assert.rejects(auth.registerUser({ name: 'Maria', email: 'maria@email.com', password: '123456' }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
    assert.match(error.message, /confirme seu e-mail/i);
    return true;
  });
});

test('loginUser devolve a AuthResponse; nome vazio na metadata cai no prefixo do e-mail', async () => {
  const session = sessionFor({ user_metadata: { name: '   ' } });
  const auth = createAuthService(
    fakeClient({ signInWithPassword: async () => ({ data: { user: session.user, session }, error: null }) }),
  );
  const response = await auth.loginUser({ email: 'maria@email.com', password: 'senha123' });
  assert.deepEqual(response, {
    message: 'Login realizado com sucesso.',
    token: 'token-123',
    user: { id: 'user-1', name: 'maria', email: 'maria@email.com' },
  });
});

test('loginUser: credenciais inválidas viram 401', async () => {
  const auth = createAuthService(
    fakeClient({ signInWithPassword: async () => ({ data: { user: null, session: null }, error: { code: 'invalid_credentials', status: 400 } }) }),
  );
  await assert.rejects(auth.loginUser({ email: 'a@a.com', password: 'errada1' }), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.message, 'E-mail ou senha inválidos.');
    return true;
  });
});

test('cliente que lança exceção vira erro de rede (status 0)', async () => {
  const auth = createAuthService(
    fakeClient({
      signInWithPassword: async () => {
        throw new TypeError('Network request failed');
      },
    }),
  );
  await assert.rejects(auth.loginUser({ email: 'a@a.com', password: '123456' }), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 0);
    assert.equal(error.message, NETWORK_MESSAGE);
    return true;
  });
});

test('chamada que nunca responde estoura o timeout e vira erro de rede (status 0)', async () => {
  const auth = createAuthService(
    fakeClient({ signInWithPassword: () => new Promise(() => {}) }),
    { timeoutMs: 20 },
  );
  await assert.rejects(auth.loginUser({ email: 'a@a.com', password: '123456' }), (error) => {
    assert.equal(error.status, 0);
    return true;
  });
});

test('signOutUser chama o cliente e propaga erro mapeado', async () => {
  let called = false;
  const ok = createAuthService(fakeClient({ signOut: async () => { called = true; return { error: null }; } }));
  await ok.signOutUser();
  assert.equal(called, true);

  const failing = createAuthService(fakeClient({ signOut: async () => ({ error: { status: 0, name: 'AuthRetryableFetchError' } }) }));
  await assert.rejects(failing.signOutUser(), (error) => error.status === 0);
});

test('restoreSession devolve a sessão guardada', async () => {
  const session = sessionFor();
  const auth = createAuthService(fakeClient({ getSession: async () => ({ data: { session }, error: null }) }));
  assert.deepEqual(await auth.restoreSession(), {
    message: 'Sessão restaurada.',
    token: 'token-123',
    user: { id: 'user-1', name: 'Maria Souza', email: 'maria@email.com' },
  });
});

test('restoreSession devolve null sem sessão, com erro do Supabase ou com exceção (nunca rejeita)', async () => {
  const none = createAuthService(fakeClient({ getSession: async () => ({ data: { session: null }, error: null }) }));
  assert.equal(await none.restoreSession(), null);

  const withError = createAuthService(fakeClient({ getSession: async () => ({ data: { session: null }, error: { message: 'jwt expired', status: 401 } }) }));
  assert.equal(await withError.restoreSession(), null);

  const throwing = createAuthService(fakeClient({ getSession: async () => { throw new Error('storage corrompido'); } }));
  assert.equal(await throwing.restoreSession(), null);

  const hanging = createAuthService(fakeClient({ getSession: () => new Promise(() => {}) }), { timeoutMs: 20 });
  assert.equal(await hanging.restoreSession(), null);
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run (na raiz do projeto): `node --test "services/**/*.test.mjs"`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `./auth-core.ts`.

- [ ] **Step 3: Implementar `services/auth-core.ts`**

```ts
/**
 * Auth logic with no React Native imports: the Supabase client is injected, so this file runs (and is
 * tested) under plain Node. `services/auth.ts` wires it to the real client.
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
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new ApiError(RATE_LIMIT_MESSAGE, 429);
    case 'signup_disabled':
      return new ApiError('Cadastros estão desativados no momento.', 403);
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

  return { registerUser, loginUser, signOutUser, restoreSession };
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `node --test "services/**/*.test.mjs"`
Expected: todos os testes PASS (0 fail). Se o Node reclamar de sintaxe TypeScript não suportada, reescrever a construção apontada usando apenas sintaxe "apagável" (sem `enum`, `namespace`, parameter properties).

- [ ] **Step 5: Instalar as dependências do cliente**

Run: `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill`
Expected: as três entram em `dependencies` de `package.json` com versões compatíveis com o Expo 57.

- [ ] **Step 6: Criar `services/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local (veja .env.example) e reinicie o Expo.',
  );
}

// The static web export renders on the server, where there is no localStorage for AsyncStorage to use.
const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(canPersist ? { storage: AsyncStorage } : {}),
    persistSession: canPersist,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
```

- [ ] **Step 7: Reescrever `services/auth.ts`**

Substituir o conteúdo inteiro por:

```ts
import { createAuthService } from './auth-core';
import { supabase } from './supabase';

export { ApiError, errorMessage } from './auth-core';
export type { AuthResponse } from './auth-core';

const auth = createAuthService(supabase);

export const registerUser = auth.registerUser;
export const loginUser = auth.loginUser;
export const signOutUser = auth.signOutUser;
export const restoreSession = auth.restoreSession;
```

- [ ] **Step 8: Criar `.env.example` e `.env.local`**

`.env.example` (sem valores reais):

```
# Supabase (Project Settings → API). Só a chave publishable vai no app; NUNCA a service_role.
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

`.env.local` com os valores reais de `mcp__supabase__get_project_url` e `mcp__supabase__get_publishable_keys` (mesmo formato). Confirmar que o git o ignora: `git check-ignore -v .env.local` deve apontar a regra `.env*.local`.

- [ ] **Step 9: Ajustar `package.json`**

Trocar apenas o script `test` (os demais scripts do Mongo saem na Task 6):

```json
"test": "node --test \"services/**/*.test.mjs\"",
```

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 10: Typecheck e lint**

Run: `npx tsc --noEmit` e `npx expo lint`
Expected: sem erros. Se o `tsc` reclamar que o `SupabaseClient` não é atribuível a `AuthClientLike` em `services/auth.ts`, ajustar os tipos estruturais de `AuthClientLike`/`SignInResult` em `auth-core.ts` até casarem (não usar `any`, não usar `as unknown as`). Se o lint reclamar do import `./auth-core.ts` no teste `.mjs` (regra de import não resolvido), ignorar `*.test.mjs` dessa regra em `eslint.config.js` ou adicionar `**/*.test.mjs` a `ignores`.

- [ ] **Step 11: Checkpoint**

`npm test`, `npx tsc --noEmit` e `npx expo lint` limpos. Não há commit.

---

### Task 5: Sessão no app — restauração, logout e telas

**Files:**
- Modificar: `contexts/profile-context.tsx`, `app/index.tsx`, `app/(tabs)/profile.tsx:85-101`, `app/account.tsx:100-116`

**Interfaces:**
- Consumes: `restoreSession`, `signOutUser` (de `@/services/auth`), `supabase` (de `@/services/supabase`), `AuthResponse`.
- Produces: `useProfile()` passa a expor também `isRestoringSession: boolean`.

- [ ] **Step 1: `ProfileProvider` restaura a sessão e escuta o Supabase**

Em `contexts/profile-context.tsx`: importar `useEffect`, `restoreSession` e `supabase`; adicionar `isRestoringSession` ao tipo e ao valor; adicionar o efeito. Resultado final do arquivo:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { restoreSession } from '@/services/auth';
import { supabase } from '@/services/supabase';

type ProfileContextValue = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  memberSince: number;
  token: string;
  isAuthenticated: boolean;
  /** True until the session saved on the device has been checked; screens that redirect on auth should wait. */
  isRestoringSession: boolean;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setCpf: (cpf: string) => void;
  setBirthDate: (birthDate: string) => void;
  setToken: (token: string) => void;
  setIsAuthenticated: (value: boolean) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [memberSince] = useState(() => Date.now());
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    let active = true;

    // restoreSession never rejects; a missing or broken saved session just leaves the user signed out.
    restoreSession().then((session) => {
      if (!active) return;
      if (session) {
        setName(session.user.name);
        setEmail(session.user.email);
        setToken(session.token);
        setIsAuthenticated(true);
      }
      setIsRestoringSession(false);
    });

    // Only plain state updates inside this callback: calling other supabase.auth methods here can deadlock.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        setToken(session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setName('');
        setEmail('');
        setToken('');
        setIsAuthenticated(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        name,
        email,
        phone,
        cpf,
        birthDate,
        memberSince,
        token,
        isAuthenticated,
        isRestoringSession,
        setName,
        setEmail,
        setPhone,
        setCpf,
        setBirthDate,
        setToken,
        setIsAuthenticated,
      }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
```

- [ ] **Step 2: `app/index.tsx` espera a restauração**

```tsx
import { Redirect } from 'expo-router';

import { useProfile } from '@/contexts/profile-context';

/** Signed-in shoppers go straight to the storefront; everyone else starts at the welcome screen. */
export default function RootIndex() {
  const { isAuthenticated, isRestoringSession } = useProfile();
  if (isRestoringSession) return null;
  return <Redirect href={isAuthenticated ? '/home' : '/onboarding'} />;
}
```

- [ ] **Step 3: Logout encerra a sessão no Supabase**

Em `app/(tabs)/profile.tsx`, adicionar `import { signOutUser } from '@/services/auth';` junto dos imports de `@/services` (ou logo após o último import `@/...`) e trocar o `onPress` do botão "Sair" (linhas ~91-98) por:

```tsx
        onPress: async () => {
          // If the network call fails the local session is still dropped by supabase-js; clear the UI either way.
          await signOutUser().catch(() => undefined);
          clearCart();
          setName('');
          setEmail('');
          setToken('');
          setIsAuthenticated(false);
          router.dismissTo('/onboarding');
        },
```

- [ ] **Step 4: "Excluir conta" também encerra a sessão**

Em `app/account.tsx`, adicionar `import { signOutUser } from '@/services/auth';` e trocar o `onPress` do botão "Excluir" (linhas ~103-114) por:

```tsx
        onPress: async () => {
          leavingRef.current = true;
          // Deleting the Supabase account itself needs a server-side function (LGPD work, not built yet);
          // for now this signs out so the saved session doesn't bring the user back in on the next launch.
          await signOutUser().catch(() => undefined);
          clearCart();
          setName('');
          setEmail('');
          setPhone('');
          setCpf('');
          setBirthDate('');
          setToken('');
          setIsAuthenticated(false);
          router.dismissTo('/onboarding');
        },
```

- [ ] **Step 5: Conferir que login/register não precisam mudar**

`app/login.tsx` e `app/register.tsx` usam `loginUser`/`registerUser`, `ApiError` (`status === 401` e `409`), `errorMessage` e `response.{user.name,user.email,token}`: tudo preservado por `auth-core.ts`. Verificar com `Grep` que não sobrou nenhum uso de `API_BASE_URL`: `Grep pattern: API_BASE_URL` (excluindo `node_modules`) deve dar zero resultados.

- [ ] **Step 6: Typecheck, lint e testes**

Run: `npx tsc --noEmit`, `npx expo lint`, `npm test`
Expected: sem erros e testes PASS.

- [ ] **Step 7: Checkpoint**

Nada rodando foi alterado ainda (o Expo só vai enxergar `.env.local` quando o usuário reiniciá-lo, ver Task 7). Não há commit.

---

### Task 6: Remover o MongoDB

**Files:**
- Remover: `server/` (inteiro), `docs/superpowers/plans/2026-09-23-mongodb-persistence-phase1-session-profile.md`, `docs/superpowers/specs/2026-09-23-mongodb-persistence-design.md`
- Modificar: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: nada das tasks anteriores (independente), mas roda depois delas para o app já não depender do servidor.
- Produces: repositório e máquina sem MongoDB/Express em execução.

- [ ] **Step 1: Identificar os processos pelas portas (reconferir antes de parar)**

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3001,27017 -ErrorAction SilentlyContinue |
  ForEach-Object {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
    "{0} pid={1} {2} :: {3}" -f $_.LocalPort, $_.OwningProcess, $p.Name, $p.CommandLine
  }
```

Expected: a porta 27017 pertence a `mongod.exe`; a 3001 a um `node` cuja linha de comando contém `server/index.js` (ou `server\index.js`). Se a 3001 pertencer a outra coisa (ex.: Expo ou outro projeto), PARAR e perguntar ao usuário. Nunca tocar na 8081.

- [ ] **Step 2: Parar o servidor Express e o mongod, cada um pelo PID**

```powershell
Stop-Process -Id <PID do node da 3001> -Confirm:$false
Stop-Process -Id <PID do mongod da 27017> -Confirm:$false
```

- [ ] **Step 3: Confirmar que as portas ficaram livres e o Expo segue de pé**

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3001,27017 -ErrorAction SilentlyContinue
Get-Process mongod -ErrorAction SilentlyContinue
Get-NetTCPConnection -State Listen -LocalPort 8081 -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess
```

Expected: as duas primeiras sem saída; a terceira ainda mostra a 8081. Se o `mongod` reaparecer sozinho, é serviço: `Get-Service *mongo*` e reportar ao usuário (não desinstalar).

- [ ] **Step 4: Apagar os arquivos do MongoDB**

Run (Bash, na raiz do projeto):

```bash
rm -rf server
rm -f docs/superpowers/plans/2026-09-23-mongodb-persistence-phase1-session-profile.md docs/superpowers/specs/2026-09-23-mongodb-persistence-design.md
ls
ls docs/superpowers/plans docs/superpowers/specs
```

Expected: sem `server/`; `plans/` contém só `2026-09-28-supabase-migration.md` e `specs/` só `2026-09-28-supabase-migration-design.md`.

- [ ] **Step 5: Remover scripts e dependências**

Em `package.json`, remover os scripts `server`, `server:dev` e `test:db` (o `test` já foi trocado na Task 4). Depois:

Run: `npm uninstall mongoose bcryptjs jsonwebtoken express cors`
Expected: as cinco saem de `dependencies`; `package-lock.json` e `node_modules` atualizados sem erro.

- [ ] **Step 6: Busca final por qualquer resquício**

`Grep` (case-insensitive) por `mongo` em todo o projeto, excluindo `node_modules`:

```
pattern: mongo
-i: true
path: <raiz do projeto>
glob: !node_modules/**
```

Expected: ocorrências **apenas** nos dois documentos desta migração (`docs/superpowers/specs/2026-09-28-supabase-migration-design.md` e `docs/superpowers/plans/2026-09-28-supabase-migration.md`), que descrevem a remoção. Qualquer outra ocorrência (código, `package.json`, `package-lock.json`, `README.md`, `FireStock-*.md`, `.claude/`, `.vscode/`) deve ser removida/ajustada. Também procurar `express|cors|jsonwebtoken|bcrypt` fora de `node_modules` e `package-lock.json`: zero resultados.

- [ ] **Step 7: Typecheck, lint e testes**

Run: `npx tsc --noEmit`, `npx expo lint`, `npm test`
Expected: sem erros e testes PASS.

- [ ] **Step 8: Checkpoint**

Portas 3001 e 27017 livres, 8081 intacta, busca por `mongo` limpa. O MongoDB do Windows continua instalado (fora de escopo). Não há commit.

---

### Task 7: Verificação ponta a ponta, docs e limpeza

**Files:**
- Modificar: `FireStock-PRD.md`, `FireStock-tasks.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: migração validada, docs atualizados, banco sem dados de teste.

- [ ] **Step 1: Pedir ao usuário que reinicie o Expo**

O Expo (8081) subiu antes de existir o `.env.local` e das dependências novas. Pedir ao usuário para reiniciá-lo limpando o cache (`npx expo start -c`) e aguardar a confirmação. **Não** reiniciar por conta própria. Confirmar também que "Confirm email" está desligado.

- [ ] **Step 2: Cadastrar pelo app (web em `http://localhost:8081`) e conferir no banco**

Usar as ferramentas do Chrome (`claude-in-chrome`, invocar a skill antes) ou, se indisponíveis, pedir ao usuário para testar no aparelho/Expo Go. Fluxo: abrir o app → Onboarding → Criar conta → nome `Teste App`, e-mail `firestok-teste-app@example.com`, senha `Teste@12345`, aceitar os termos → deve cair em `/home`.

Depois `mcp__supabase__execute_sql`:

```sql
select p.full_name, p.email, p.role
from public.profiles p join auth.users u on u.id = p.id
where u.email = 'firestok-teste-app@example.com';
```

Expected: `Teste App | firestok-teste-app@example.com | consumer`.

- [ ] **Step 3: Sessão persiste, logout e novo login**

Recarregar a página (ou reabrir o app): deve continuar logado e ir para `/home` sem passar pelo onboarding. Perfil → Sair → deve voltar ao onboarding; recarregar de novo: deve ficar no onboarding. Login com `firestok-teste-app@example.com` / `Teste@12345` deve entrar; senha errada deve mostrar "E-mail ou senha incorretos."; cadastrar de novo o mesmo e-mail deve mostrar "Este e-mail já tem uma conta. Tente entrar."

- [ ] **Step 4: Checagens finais de código**

Run: `npx tsc --noEmit`, `npx expo lint`, `npm test`
Expected: tudo limpo. Repetir `Grep -i mongo` (Task 6, Step 6): só os dois docs desta migração.

- [ ] **Step 5: Reexecutar a verificação de RLS**

Run: `bash <scratchpad>/rls-check.sh` — como o parceiro/endereço de teste do passo 7/9 já existem, o script pode falhar em `A cria parceiro pendente` por CNPJ duplicado; nesse caso apagar antes (Step 7) e repetir. Objetivo: garantir que nada mudou nas políticas depois das Tasks 4 a 6. Expected: `TUDO OK`.

- [ ] **Step 6: Atualizar a documentação**

`FireStock-tasks.md`, na seção "Planejamento inicial", marcar:
- `- [x] Definir arquitetura de backend e tecnologias a serem usadas. (Supabase: Auth + Postgres com RLS, acesso direto do app)`
- `- [x] Modelar o banco de dados relacional. (11 tabelas em `public`; ver docs/superpowers/specs/2026-09-28-supabase-migration-design.md)`

`FireStock-PRD.md`, na seção "Tarefas Prioritárias → 1. Arquitetura e backend", marcar como feitos `Definir arquitetura de backend e API REST.` (reescrever como `Definir arquitetura de backend (Supabase Auth + Postgres/RLS, sem servidor próprio).`) e `Modelar banco de dados relacional (...)`, e em "O que falta ser criado" ajustar `Backend e persistência real de usuários, produtos e reservas` para `Persistência real de produtos e reservas (usuários/perfis já no Supabase)`.

- [ ] **Step 7: Limpar os dados de teste do Supabase**

`mcp__supabase__execute_sql`:

```sql
delete from public.partners
where owner_id in (select id from auth.users where email like 'firestok-teste-%');

delete from auth.users where email like 'firestok-teste-%';

select
  (select count(*) from auth.users where email like 'firestok-teste-%') as usuarios_teste,
  (select count(*) from public.profiles) as perfis,
  (select count(*) from public.partners) as parceiros,
  (select count(*) from public.addresses) as enderecos;
```

Expected: `usuarios_teste = 0`, `perfis = 0`, `parceiros = 0`, `enderecos = 0` (os perfis, endereços e demais dados privados saem por `ON DELETE CASCADE`). Se `profiles` ainda tiver linhas, listar e investigar antes de apagar mais nada. Apagar também `rls-check.sh` e os arquivos temporários do scratchpad.

- [ ] **Step 8: Advisors finais e relatório**

`mcp__supabase__get_advisors` (`security` e `performance`). Reportar ao usuário: o que foi criado (11 tabelas, RLS, 4 migrations), o que foi removido (processos, `server/`, deps, docs), o que ficou de fora de propósito (funções de reserva/estoque, integração das demais telas, exclusão real da conta, e-mails reais, MongoDB do Windows e seus dados em disco), o aviso de que "Excluir conta" só encerra a sessão por enquanto, e que reativar "Confirm email" exigirá uma tela de "confirme seu e-mail" no app.

- [ ] **Step 9: Checkpoint final**

Critérios do spec §1: (1) cadastro cria conta + perfil ✔ Step 2; (2) login e sessão persistente ✔ Step 3; (3) zero referência a MongoDB ✔ Step 4; (4) nenhum processo do Mongo/Express ✔ Task 6 Step 3; (5) advisors sem alertas causados por este trabalho ✔ Step 8. Não há commit, a menos que o usuário peça.
