# FireStock · web-empresa

Painel da empresa parceira: cadastro, aprovação e gestão dos produtos perto do vencimento que aparecem no app.
Design: `projeto-firestok-claude-wonderful-tesla-pppluq/docs/superpowers/specs/2026-10-19-web-empresa-design.md`.

## Rodar

```bash
cd web-empresa
cp .env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (os mesmos do app)
npm install
npm run dev                  # http://localhost:8100
```

Antes de usar o link do e-mail de recuperação de senha, adicione `http://localhost:8100/**` (e depois o endereço
publicado) em Supabase → Authentication → URL Configuration → Redirect URLs.

## Comandos

- `npm test` — testes da lógica (CNPJ, preço, regras de produto).
- `npm run typecheck` · `npm run build`.

## Fluxo

1. `/cadastro` cria o acesso (e-mail e senha); confirmar o e-mail pelo link recebido.
2. `/entrar` → `/empresa` (dados da empresa) → `/aguardando` até a aprovação.
3. Aprovada, a empresa usa `/produtos` (lista, busca, filtros), `/produtos/novo` e `/produtos/:id`.

Enquanto não existe o web-admin, a aprovação é feita no banco:

```sql
update public.partners set status = 'approved', approved_at = now() where id = '<id da empresa>';
-- recusar: status = 'rejected', rejection_reason = 'motivo'
```

## Regras no banco (migração `web_empresa_rules`, em `supabase/migrations/`)

Já existiam: bloqueio de autoaprovação (`protect_partner_columns`), desconto 20–90, quantidade ≥ 0, `price_cents`
calculado e CNPJ único. Esta etapa acrescentou: validade futura (RN001), papel `partner` ao cadastrar a empresa e o
bucket `product-images` (público para leitura; só o dono de empresa aprovada grava, na própria pasta).

## Teste de ponta a ponta

`e2e/flow.cjs` (fases A–D) usa o Chrome headless e a conta de teste `cavalheiro242+empresa1@gmail.com`; a confirmação
de e-mail e a aprovação são feitas no banco entre as fases, e os dados de teste devem ser apagados no fim.

## Limites desta etapa

Sem web-admin, sem reservas, sem dados bancários e sem vários usuários por empresa.
"Remover" é exclusão lógica (`status = 'removed'`); o modelo atual do banco não tem estado "pausado".

## Publicação e cabeçalhos de segurança

`npm run build` gera `dist/` (e antes disso `npm run headers`, que escreve os arquivos de cabeçalhos abaixo a partir de
`security-headers.mjs`, a fonte única). Publique o conteúdo de `dist/` por HTTPS.

| Hospedagem | Arquivo | O que fazer |
|---|---|---|
| Netlify / Cloudflare Pages | `public/_headers` (vai para `dist/_headers`) | nada: é lido sozinho |
| Vercel | `vercel.json` | nada: é lido sozinho (já tem o redirecionamento do SPA) |
| nginx | `deploy/nginx-security-headers.conf` | `include` dentro do bloco `server`, com `try_files $uri /index.html;` |

Cabeçalhos aplicados: `Content-Security-Policy` (só scripts do próprio site; imagens e API apenas do Supabase do projeto;
CEP pelo ViaCEP; sem iframe, sem `object`), `Strict-Transport-Security` (1 ano), `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (câmera, microfone, localização e pagamento desligados),
`Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy`. O `index.html` revalida sempre; `assets/*` tem cache longo.

Para testar a build com os mesmos cabeçalhos: `npm run build && npm run preview` (ou `npx vite preview --port 8101`).
Em desenvolvimento (`npm run dev`) os cabeçalhos **não** são aplicados, porque o Vite injeta script inline no hot reload.

Se o site passar a falar com outro endereço (outro projeto Supabase, outro serviço de CEP, CDN de imagens), edite
`security-headers.mjs` e rode `npm run headers`: a política é restritiva e bloqueia o que não está listado.

## Endereço de produção e Supabase

Portal da empresa: **https://empresa.firestok.com.br** (aponte o DNS do subdomínio para a hospedagem; o certificado HTTPS é obrigatório por causa do HSTS).

Ao publicar, confira no Supabase:

- **Authentication → URL Configuration → Redirect URLs**: `https://empresa.firestok.com.br/**` (e `http://localhost:8100/**` para testes). Sem isso, o link de recuperação de senha cai no Site URL (`https://app.firestok.com.br`) em vez de voltar para este portal.
- **Edge Functions → Secrets**: `PORTAL_URL` = `https://empresa.firestok.com.br/entrar` (botão "Acessar o portal" do e-mail de aprovação da empresa).
