# FireStock — Migração do MongoDB para o Supabase

Data: 2026-09-28
Status: aguardando revisão do spec

## 1. Objetivo

Trocar a persistência do FireStock (hoje MongoDB local + servidor Express) pelo Supabase da organização FireStok, começando do zero pelo cadastro de usuários, e remover por completo o MongoDB do projeto e da máquina de desenvolvimento (processos em execução).

### Critério de sucesso
1. Cadastrar um usuário no app cria a conta no Supabase Auth **e** a linha correspondente em `public.profiles`.
2. Login com esse usuário funciona e a sessão sobrevive a reiniciar o app.
3. Nenhuma referência a MongoDB permanece no código, nos scripts, nas dependências ou na documentação do repositório.
4. Nenhum processo do MongoDB nem o servidor Express (porta 3001) permanece rodando.
5. `get_advisors` (segurança) do Supabase sem alertas de nível ERROR/WARN causados por este trabalho.

### Fora de escopo
- Funções de negócio: reservar com decremento de estoque, cancelar, expirar reservas, confirmar retirada (o schema já comporta; a lógica vem depois).
- Integrar as demais telas (carrinho, pedidos, mercados, favoritos, endereços, pagamentos, notificações) ao banco — continuam usando contexts e dados locais.
- Campos CPF/telefone no formulário de cadastro (existem na tabela, opcionais).
- E-mail de confirmação e recuperação de senha reais (nos testes, confirmação de e-mail fica desligada).
- Migrar usuários do MongoDB (não há dados a preservar).
- Desinstalar o MongoDB do Windows ou apagar os dados dele em disco.
- Parar ou alterar o Expo (porta 8081).

## 2. Contexto atual

- App Expo/React Native. `app/login.tsx` e `app/register.tsx` chamam `services/auth.ts` (`loginUser`, `registerUser`, `ApiError`, `errorMessage`), que faz `fetch` para um servidor Express em `server/` (porta 3001), com Mongoose, bcryptjs e JWT.
- `ProfileContext` guarda `name`, `email`, `token` e `isAuthenticated` só em memória.
- Supabase: organização FireStok (`ypacwauubxeuwuqofvuw`) com um único projeto, `Fenando2018's Project` (`grvhxufpbvgvgurjaavb`, us-east-1, Postgres 17), vazio.
- Processos: `mongod` (PID 9188, porta 27017, processo comum — não é serviço do Windows) e Express (PID 24412, porta 3001).
- O repositório não tem commits, e o git enxerga `Documents` como raiz. **Este trabalho não faz commits, a menos que o usuário peça.**

## 3. Decisão de arquitetura

**Supabase Auth direto no app** (`@supabase/supabase-js`). Sessão, hash de senha e JWT ficam a cargo do Supabase; o servidor Express deixa de existir. Descartadas: manter o Express com Postgres (dois serviços, JWT/bcrypt manuais) e Express intermediando o Supabase Auth (ponto de falha sem função).

Segurança: apenas a chave **publishable** vai para o app (`.env.local`, já ignorado pelo git). A `service_role` nunca é usada nem gravada no projeto. A proteção dos dados é responsabilidade das políticas RLS.

## 4. Banco de dados

Schema `public`, RLS ativada em **todas** as tabelas. Valores monetários em centavos (`integer`). Todas as tabelas têm `created_at timestamptz default now()`; as editáveis têm também `updated_at` mantido por trigger.

### Tipos
- `user_role`: `consumer`, `partner`, `admin`.
- `partner_status`: `pending`, `approved`, `rejected`.
- `product_status`: `active`, `expired`, `removed`.
- `reservation_status`: `pending`, `confirmed`, `picked_up`, `cancelled`, `expired`, `no_show`.

### Tabelas

**`profiles`** — `id uuid PK` → `auth.users(id) on delete cascade`; `full_name text not null`; `email text not null`; `cpf text` (único quando preenchido); `phone text`; `birth_date date`; `role user_role not null default 'consumer'`; `suspended_until timestamptz`; `lgpd_consent_at timestamptz`.

**`partners`** — `id uuid PK`; `owner_id uuid` → `profiles(id)`; `legal_name`; `trade_name`; `cnpj text unique not null`; `category text`; `phone`; `email`; endereço (`cep`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`); `lat`, `lng double precision`; `opening_hours jsonb`; dados bancários (`bank_code`, `bank_agency`, `bank_account`); `status partner_status not null default 'pending'`; `rejection_reason text`; `approved_at`, `approved_by` → `profiles(id)`; `rating_avg numeric(3,2)`; `rating_count integer default 0`.

**`categories`** — `id`; `slug unique`; `name`. Seed com categorias de alimentos/bebidas/higiene/limpeza/pet. Medicamentos e suplementos **não** entram (RN010).

**`products`** — `id`; `partner_id` → `partners`; `category_id` → `categories`; `name`; `description`; `image_url`; `barcode`; `original_price_cents integer > 0`; `discount_percent integer` com `check (between 20 and 90)` (RN002); `price_cents` (coluna gerada: `original × (100 − desconto) / 100`); `quantity integer check (>= 0)` (0 = "Esgotado", RN003); `expires_at timestamptz not null`; `status product_status default 'active'`. Check `expires_at > created_at` (RN001).

**`reservations`** — `id`; `consumer_id` → `profiles`; `partner_id` → `partners`; `pickup_code text not null` (único por reserva); `status reservation_status default 'pending'`; `total_cents`; `pickup_deadline timestamptz`; `cancelled_at`; `picked_up_at`.
**`reservation_items`** — `id`; `reservation_id` → `reservations on delete cascade`; `product_id` → `products`; `quantity > 0`; `unit_price_cents` (preço congelado no momento da reserva).

**`reviews`** — `id`; `reservation_id unique` → `reservations` (uma avaliação por reserva concluída, RN009); `consumer_id`; `partner_id`; `rating smallint check (1..5)`; `comment`.

**`notifications`** — `id`; `user_id` → `profiles`; `kind text`; `category text` (`pedidos`/`promocoes`/`conta`); `title`; `message`; `reservation_id` (opcional); `read_at timestamptz`.

**`favorites`** — PK composta (`user_id`, `product_id`) → `profiles`, `products`.

**`addresses`** — `id`; `user_id`; `label`; `tag` (`casa`/`trabalho`/`outro`); `cep`, `street`, `number`, `complement`, `neighborhood`, `city`; `lat`, `lng`; `is_default boolean` (no máximo um por usuário, via índice único parcial).

**`payment_methods`** — `id`; `user_id`; `type` (`pix`/`dinheiro`/`cartao`); para cartão: `brand`, `kind` (`credito`/`debito`), `holder_name`, `last4 char(4)`, `expiry`. **Nunca** se armazena número completo, CVV nem dados sensíveis de cartão.

### Cadastro automático do perfil
Função `public.handle_new_user()` (`SECURITY DEFINER`, `search_path` fixo) + trigger `after insert on auth.users`: cria a linha em `profiles` com `full_name` vindo de `raw_user_meta_data->>'name'` e `email` do usuário; `role` sempre `consumer`.

### Políticas RLS
- Função auxiliar `public.is_admin()` (`SECURITY DEFINER`, `search_path` fixo), usada nas políticas administrativas.
- `profiles`: usuário lê/atualiza apenas a própria linha; admin lê todas. O usuário **não** pode alterar `role`, `suspended_until` nem `lgpd_consent_at` além do que a política permitir (revogar `UPDATE` dessas colunas de `authenticated`; `full_name`, `phone`, `cpf`, `birth_date` continuam editáveis).
- `partners`: leitura pública apenas de `approved`; o dono lê/edita o próprio (sem mudar `status`, `approved_*`, `rating_*`); o admin gerencia todos.
- `categories`: leitura pública; escrita só admin.
- `products`: leitura pública de `active` de parceiros aprovados; o dono do parceiro (aprovado) cria/edita/remove os seus (RN008); admin gerencia todos.
- `reservations` / `reservation_items`: consumidor lê as suas; dono do parceiro lê as do seu parceiro; escrita direta bloqueada nesta etapa (será feita por funções de negócio futuras); admin lê todas.
- `reviews`: leitura pública; o consumidor cria a sua apenas para reserva sua em `picked_up`.
- `notifications`, `favorites`, `addresses`, `payment_methods`: acesso total somente ao próprio `user_id`.

Índices nas colunas de FK e nos filtros previstos (`products(status, expires_at)`, `products(partner_id)`, `reservations(consumer_id)`, `reservations(partner_id)`, `notifications(user_id, read_at)`).

### Como aplicar
Migrations versionadas via MCP (`apply_migration`), em ordem: (1) tipos e tabelas, (2) trigger e função de perfil, (3) RLS e políticas, (4) índices e seed de categorias. Ao final: `get_advisors` de segurança e performance, corrigindo o que for consequência desta migração.

## 5. App

### Novos/alterados
- **`services/supabase.ts`** (novo): cria o cliente com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; sessão persistida em `@react-native-async-storage/async-storage` (dependência nova); `autoRefreshToken` ligado; `detectSessionInUrl` desligado. Falha com mensagem clara se as variáveis não estiverem definidas.
- **`services/auth.ts`** (reescrito por dentro, mesma superfície pública): mantém `registerUser`, `loginUser`, `ApiError`, `errorMessage` e o tipo `AuthResponse` (`{ message, token, user: { id, name, email } }`, onde `token` = `access_token` da sessão). `registerUser` usa `supabase.auth.signUp` com `options.data.name`; `loginUser` usa `signInWithPassword`. Erros do Supabase são traduzidos para PT-BR e mapeados para `ApiError`: e-mail já cadastrado → 409; credenciais inválidas → 401; sem rede/timeout → 0; demais → mensagem genérica. Se `signUp` não devolver sessão (confirmação de e-mail ativada), retorna erro claro em vez de fingir sucesso.
- **`app/login.tsx` e `app/register.tsx`**: mudanças mínimas, só se o contrato acima exigir. O formulário de cadastro continua com nome, e-mail e senha.
- **`.env.local`** (novo, ignorado pelo git) com URL e chave publishable; `.env.example` sem valores reais documenta as variáveis.
- **Persistência da sessão**: ao iniciar, o app lê a sessão do Supabase e preenche o `ProfileContext` (`name`, `email`, `token`, `isAuthenticated`). Logout chama `supabase.auth.signOut()`. Se o logout hoje só limpa o contexto, passa a chamar também o `signOut`.

### Remoções do código
Ver seção 6. `API_BASE_URL` e a lógica de descoberta de host do Express saem de `services/auth.ts`.

## 6. Remoção do MongoDB

1. **Processos** (cada um pelo PID, depois de reconferir que a porta ainda pertence ao mesmo processo): parar o Express (porta 3001) e o `mongod` (porta 27017). Não usar `pkill`/kill por nome. O Expo (8081) não é tocado.
2. **Arquivos**: apagar `server/` inteiro (`index.js`, `auth.js`, `rate-limit.js`, testes) e, em `docs/superpowers/`, o spec e o plano de 2026-09-23 sobre MongoDB (o repositório não tem commits, então a remoção é definitiva — o usuário aprovou).
3. **`package.json`**: remover os scripts `server`, `server:dev` e `test:db`; redefinir `test` para rodar os testes novos de `services/auth` (em vez de `server/auth.test.js`); remover as dependências `mongoose`, `bcryptjs`, `jsonwebtoken`, `express`, `cors`. Reinstalar (`npm install`) para atualizar `package-lock.json` e `node_modules`. O script `test` passa a rodar os testes novos do `services/auth`.
4. **Documentos**: ajustar `FireStock-PRD.md` e `FireStock-tasks.md` onde citarem backend/MongoDB para refletir o Supabase (apenas trechos afetados).
5. **Verificação final**: busca por `mongo` (case-insensitive) em todo o repositório, exceto `node_modules`, deve retornar zero resultados; `netstat`/`Get-NetTCPConnection` não pode mostrar as portas 3001 e 27017 em escuta.

Não fazem parte: desinstalar o MongoDB do Windows e apagar sua pasta de dados.

## 7. Verificação

1. **Banco**: `list_tables` mostra todas as tabelas com RLS ativada; `get_advisors` sem alertas causados por este trabalho.
2. **Cadastro real**: `signUp` via API do Supabase Auth com um usuário de teste → `execute_sql` confirma a linha em `profiles` com `role = 'consumer'` e `full_name` correto.
3. **Login**: `signInWithPassword` com o mesmo usuário devolve sessão; senha errada devolve erro.
4. **RLS**: com o JWT do usuário de teste, ler o `profiles` de outro usuário retorna vazio; tentar `update profiles set role = 'admin'` na própria linha falha; escrever em `reservations` diretamente falha.
5. **Código**: `npx tsc --noEmit` e `npm run lint` limpos.
6. **Testes unitários** (`node --test`): mapeamento de erros do Supabase para `ApiError`/mensagens PT-BR em `services/auth`, com o cliente Supabase injetável/mockado.
7. **Fluxo no app**: com o Expo já rodando, cadastrar pela tela `register`, confirmar entrada em `/home`, reabrir o app e continuar logado, sair e logar de novo.
8. **Limpeza**: remover do Supabase (Auth e `profiles`) todos os usuários criados nos testes.

## 8. Pré-requisito manual do usuário

Desligar **Confirm email** no painel do Supabase (Authentication → Providers → Email) antes do teste de cadastro no app. O MCP não altera essa configuração. Sem isso, `signUp` não devolve sessão e o app exibe o erro claro descrito na seção 5.

## 9. Riscos e decisões registradas

- **Projeto único e sem nome do produto**: o projeto se chama `Fenando2018's Project`. Usado como está; renomear é opcional e feito pelo usuário no painel.
- **Sem commits**: nada é commitado nem enviado a serviços externos além do próprio Supabase.
- **Remoção irreversível dos docs de MongoDB**: aprovada no design.
- **`role` protegida por privilégio de coluna**: se o `apply_migration` ou o advisor indicarem que a revogação por coluna conflita com a política, a alternativa é um trigger `before update` que rejeita mudança de `role` por usuários não-admin.
