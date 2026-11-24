# web-empresa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel web para a empresa parceira se cadastrar, ser aprovada e gerir os produtos perto do vencimento que o app vai exibir.

**Architecture:** SPA React/Vite falando direto com o Supabase (Auth + Postgres + Storage) com a chave publishable; toda regra de negócio crítica vive no banco (RLS, gatilhos, restrições). O site só valida para dar feedback rápido.

**Tech Stack:** React 19, Vite, TypeScript, React Router, `@supabase/supabase-js`, Vitest, CSS próprio com os tokens do app.

**Spec:** `docs/superpowers/specs/2026-10-19-web-empresa-design.md`

## Global Constraints

- Projeto Supabase `grvhxufpbvgvgurjaavb`; site usa só `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; nenhuma chave secreta no site.
- Pasta: `C:\Users\lsilveira\Documents\teste-app\web-empresa`; porta de desenvolvimento 8100.
- Desconto entre 20 e 90 (RN002); validade futura na criação (RN001); medicamentos e suplementos proibidos (RN010); só empresa `approved` publica (RN008); estoque 0 = "Esgotado" (RN003).
- Tokens: navy `#000851`, orange `#F05219`, background `#F8FAFC`, success `#16A34A`, error `#DC2626`, raios 14/16/20. Textos em pt-BR.
- Remover produto = `status = 'removed'`. Confirmação de e-mail ligada: cadastro em duas etapas.

## Review Focus

- CNPJ com máscara, com letras ou com todos os dígitos iguais: recusar com mensagem clara.
- Preço digitado com vírgula ("12,90") ou ponto: aceitar e converter para centavos sem erro de arredondamento.
- Foto grande demais ou de tipo errado: avisar antes de enviar e nunca deixar o produto salvo sem a foto prometida.
- Duplo clique em "Salvar": não criar dois produtos.
- Sessão expirada no meio do cadastro: voltar ao login sem perder o que foi digitado quando possível.
- Empresa recusada: ver o motivo e não ver a área de produtos.

---

### Task 1: Regras no banco (migrações)

**Files:** migrações via MCP `apply_migration`; cópia do SQL em `web-empresa/supabase/migrations/` (documentação).

**Interfaces:** Produz, para as tarefas seguintes: gatilho que impede não-admin de alterar `status/rejection_reason/approved_at/approved_by/owner_id/rating_avg/rating_count` em `partners`; restrições em `products` (`discount_percent between 20 and 90`, `quantity >= 0`, `original_price_cents > 0`); gatilho que preenche `price_cents = round(original_price_cents * (100 - discount_percent) / 100.0)` e bloqueia `expires_at` no passado em INSERT ou quando `expires_at` muda; bucket público `product-images` (JPEG/PNG/WebP, 2 MB) com escrita só do dono de empresa aprovada na pasta `{partner_id}/`; garantia de que o cadastro público nunca gera `role = 'admin'`.

- [ ] **Step 1:** Ler a função atual que cria `profiles` no cadastro e as restrições já existentes em `products` (consulta ao catálogo) para decidir só o que falta; anotar o resultado no topo da migração.
- [ ] **Step 2:** Escrever as verificações como consultas que devem FALHAR hoje: dono atualiza o próprio `status` para `approved`; produto com desconto 10; produto com validade passada; upload em pasta de outra empresa.
- [ ] **Step 3:** Aplicar as migrações (gatilho de `partners`, restrições e gatilho de `products`, bucket e políticas de storage, ajuste de `role`).
- [ ] **Step 4:** Reexecutar as verificações simulando papéis (`set local role authenticated` + claims) dentro de transação revertida: todas as ações proibidas falham e as permitidas (dono aprovado insere produto com desconto 30 e validade futura) passam; `price_cents` sai calculado.

### Task 2: Projeto, tema e acesso ao Supabase

**Files:** Create: `web-empresa/package.json`, `vite.config.ts`, `index.html`, `.env.example`, `.env.local`, `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `src/styles/global.css`, `src/lib/supabase.ts`, `src/assets/logo.png`.

**Interfaces:** Produz `supabase` (cliente único) em `src/lib/supabase.ts`; classes/tokens CSS (`--navy`, `--orange`, botões `.btn`, `.btn-primary`, campos `.field`, cartões `.card`); rotas declaradas em `App.tsx`.

- [ ] **Step 1:** Criar o projeto Vite React TS com Vitest e React Router; dev na porta 8100.
- [ ] **Step 2:** `tokens.css` com os tokens do app; `global.css` com botões, campos (foco azul-marinho, sem contorno preto do navegador), cartões e mensagens de erro/sucesso; copiar a logo de `docs/emails/logo-firestock.png`.
- [ ] **Step 3:** `supabase.ts` lê as duas variáveis `VITE_*` e falha com mensagem clara se faltarem.
- [ ] **Step 4:** Verificar `npm run build` e `npm run dev` abrindo uma página inicial com a logo.

### Task 3: Lógica pura com testes

**Files:** Create: `src/lib/cnpj.ts`, `src/lib/money.ts`, `src/lib/product-rules.ts`, `src/lib/format.ts` e `*.test.ts` de cada.

**Interfaces:** Produz `isValidCnpj(value: string): boolean`, `formatCnpj(value: string): string`, `parsePriceToCents(input: string): number | null`, `formatCents(cents: number): string` (`R$ 12,90`), `finalPriceCents(originalCents: number, discountPercent: number): number`, `validateProduct(input: ProductInput, now: Date): Record<string, string>` (mapa campo→mensagem; vazio = válido), `productState(p: { status; quantity; expires_at }, now: Date): 'active' | 'soldout' | 'expired' | 'paused' | 'removed'`, `BLOCKED_TERMS: string[]` (medicamento, remédio, suplemento, etc.).

- [ ] **Step 1:** Escrever os testes: CNPJ válido `11.222.333/0001-81` passa, `11.111.111/1111-11` e letras falham; `parsePriceToCents("12,90")=1290`, `"12.9"=1290`, `"abc"=null`, `"0"=null`; `finalPriceCents(1000,30)=700`; `validateProduct` recusa desconto 19 e 91, validade passada, quantidade negativa, nome com termo bloqueado; `productState` devolve `soldout` com quantidade 0 e `expired` com validade passada.
- [ ] **Step 2:** Rodar `npx vitest run` e ver falhar.
- [ ] **Step 3:** Implementar as funções acima nos arquivos indicados.
- [ ] **Step 4:** Rodar os testes e ver passar.

### Task 4: Autenticação

**Files:** Create: `src/auth/AuthContext.tsx`, `src/auth/RequireAuth.tsx`, `src/pages/SignUp.tsx`, `src/pages/Login.tsx`, `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`, `src/layout/AuthLayout.tsx`.

**Interfaces:** Consome `supabase`. Produz `useAuth(): { session; user; loading; signOut(): Promise<void> }` e `<RequireAuth>` que manda sem sessão para `/entrar`. Rotas: `/entrar`, `/cadastro`, `/esqueci-senha`, `/nova-senha`.

- [ ] **Step 1:** `AuthContext` restaura a sessão e assina `onAuthStateChange` (só `setState` dentro do callback).
- [ ] **Step 2:** Cadastro (nome do responsável, e-mail, senha ≥ 6, confirmar senha) com `signUp` e `options.data.role = 'partner'`; depois mostrar "Confirme seu e-mail". Erros mapeados em pt-BR (e-mail já cadastrado, senha fraca, limite de envios).
- [ ] **Step 3:** Login, recuperação (`resetPasswordForEmail` com `redirectTo = origin + '/nova-senha'`) e nova senha lendo os tokens do `#` (mesmo comportamento do app: `setSession`, `updateUser`, `signOut`, ir ao login).
- [ ] **Step 4:** Verificar no navegador que `/` sem sessão vai para `/entrar` e que erros aparecem na tela.

### Task 5: Empresa (cadastro e estado de aprovação)

**Files:** Create: `src/partner/usePartner.ts`, `src/pages/CompanyForm.tsx`, `src/pages/PendingApproval.tsx`, `src/lib/viacep.ts`, `src/layout/AppLayout.tsx`.

**Interfaces:** Produz `usePartner(): { partner: Partner | null; loading; reload() }` (busca `partners` do `owner_id = auth.uid()`); `fetchAddressByCep(cep: string): Promise<{ street; neighborhood; city; state } | null>`; `AppLayout` com barra superior (logo, `trade_name`, Sair). Regra de roteamento: sem empresa → `/empresa`; `pending` → `/aguardando`; `rejected` → `/aguardando` mostrando `rejection_reason`; `approved` → `/produtos`.

- [ ] **Step 1:** Formulário com razão social, nome fantasia, CNPJ (máscara e `isValidCnpj`), telefone, e-mail de contato, categoria, CEP (preenche pelo ViaCEP), rua, número, complemento, bairro, cidade, UF; envio por `insert` em `partners` com `owner_id` e `status` omitido (default `pending`).
- [ ] **Step 2:** Tela de aprovação com estados pendente e recusada (motivo), botão para recarregar e para sair.
- [ ] **Step 3:** Verificar CNPJ repetido (restrição de unicidade, se existir) vira mensagem amigável.

### Task 6: Produtos

**Files:** Create: `src/pages/Products.tsx`, `src/pages/ProductForm.tsx`, `src/products/api.ts`, `src/components/ImageInput.tsx`, `src/components/ConfirmDialog.tsx`.

**Interfaces:** Consome `usePartner`, `validateProduct`, `finalPriceCents`, `productState`, `parsePriceToCents`. Produz em `api.ts`: `listProducts(partnerId): Promise<Product[]>`, `listCategories(): Promise<Category[]>`, `saveProduct(input, imageFile?): Promise<Product>` (cria ou atualiza; sobe a foto para `product-images/{partner_id}/{uuid}.{ext}` **antes** de gravar a URL), `setProductStatus(id, 'active' | 'removed')`. "Pausar" = `status = 'removed'` NÃO; pausar é `quantity` mantida e produto fora do ar via `status = 'expired'`? Não: usar apenas `active`/`removed` do banco; **pausar** fica fora desta etapa e a lista oferece só "Remover" (decisão registrada no passo 1).

- [ ] **Step 1:** Confirmar com o banco que só existem `active | expired | removed`; registrar no código que "pausar" não existe no modelo atual e a UI oferece apenas Remover, e atualizar a spec com essa nota.
- [ ] **Step 2:** Lista: foto, nome, categoria, preço final e original riscado, desconto, validade, quantidade, rótulo de `productState`; busca por nome; filtros por categoria e estado; estado vazio com botão "Novo produto".
- [ ] **Step 3:** Formulário: campos da spec, preço final calculado ao digitar, pré-visualização da foto, validação por `validateProduct`, bloqueio de duplo envio, recusa de foto > 2 MB ou tipo diferente de JPEG/PNG/WebP antes do envio.
- [ ] **Step 4:** Remover com `ConfirmDialog`; editar reaproveita o formulário.

### Task 7: Verificação ponta a ponta e limpeza

**Files:** Create: `web-empresa/e2e/flow.cjs` (script do navegador, fora do bundle), `web-empresa/README.md`.

- [ ] **Step 1:** `npm run build`, `npx tsc --noEmit` e `npx vitest run` sem erros.
- [ ] **Step 2:** No navegador (Chrome headless): cadastrar `cavalheiro242+empresa1@gmail.com`, confirmar o e-mail pelo banco, entrar, preencher a empresa, ver "aguardando", aprovar pelo banco, cadastrar produto com foto, editar, remover.
- [ ] **Step 3:** Conferir com a chave anônima (a mesma consulta que o app fará) que só aparece produto `active`, não vencido, de empresa aprovada; e que a empresa de teste não consegue se autoaprovar nem escrever na pasta de outra empresa.
- [ ] **Step 4:** Apagar usuário, empresa, produtos e fotos de teste; escrever o README com como rodar e as variáveis.
