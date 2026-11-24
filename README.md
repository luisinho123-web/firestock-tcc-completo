# FireStock · TCC completo

App mobile + painel web da empresa no mesmo projeto, falando com o **mesmo Supabase**
(os dois `.env.local` apontam para o mesmo projeto).

```
firestock-tcc-completo/
├── apps/
│   ├── mobile/        Expo / React Native (app do consumidor)
│   ├── web-empresa/   Vite + React (cadastro de empresas e produtos)
│   └── web-admin/     Vite + React (painel do administrador, porta 8200)
├── supabase/          migrations (functions: ver abaixo)
└── package.json       scripts da raiz
```

Cada app tem o **próprio `node_modules`** (de propósito: Expo e Vite usam versões diferentes de
bibliotecas, e juntá-las num só `node_modules` costuma quebrar o Metro).

## Rodar (dois terminais no VS Code)

```bash
npm run install:all   # uma vez (já feito nesta pasta)
npm run dev:web       # http://localhost:8100
npm run dev:mobile    # Expo (QR code / emulador; "w" abre no navegador)
```

Variáveis: `apps/web-empresa/.env.local` (`VITE_SUPABASE_*`) e `apps/mobile/.env.local`
(`EXPO_PUBLIC_SUPABASE_*`, `EXPO_PUBLIC_MAPBOX_TOKEN`). **Nunca** use a chave `service_role` nos apps.

## Estado atual

| Parte | Verificado |
|---|---|
| web-empresa | typecheck, 45 testes e build passam. Inclui o **Painel de vendas** (`/painel`), com dados reais do Supabase |
| mobile | **empacota** (`expo export --platform web`, 36 telas, sem erro de módulo). **Não foi aberto num aparelho/emulador nem testado com login real.** |
| web-admin | **criado do zero** (o código original não veio no pacote): login só para `role = admin` e painel com dados reais. Typecheck, 26 testes e build passam. Aprovar e recusar empresas na aba **Empresas** (`/empresas`), que exige `supabase/migrations/admin_partner_review.sql` |

### Painel de vendas (web-empresa, `/painel`)

Veio do `Dashboard.tsx` do projeto antigo (`Desktop/projeto_FireStock`), que lia CSVs de exemplo. Agora lê o banco:
`reservations` + `reservation_items` da empresa logada (a regra de acesso já limita ao dono), com `products` e
`categories` para nomes e categorias. **Venda = reserva com status `picked_up`.** Mostra receita, itens, pedidos,
ticket médio, reservas em aberto, top produtos (unidades/receita), vendas por categoria, receita por dia e ranking.
Os cálculos estão em `src/lib/dashboard-rules.ts` (testados) e a consulta em `src/dashboard/api.ts`.
**O painel só conta como venda a reserva que a empresa confirmou como retirada** (aba Pedidos, abaixo).

### Painel do administrador (web-admin, `npm run dev:admin` → http://localhost:8200)

Não havia código de admin no pacote (só pastas vazias), então foi feito do zero com o mesmo visual do web-empresa, a
partir do painel antigo (`Dashboard.tsx`, que mostrava todas as lojas) e do requisito RF018 do PRD.
Mostra, para a plataforma toda: receita, itens salvos, reservas (e por status), usuários ativos e novos, empresas
aprovadas/pendentes, receita por dia, empresas que mais vendem, produtos mais vendidos, vendas por categoria,
lista de empresas aguardando aprovação e ranking de empresas. Período: 7, 30, 90 dias ou tudo.
- **Aprovar e recusar empresas (aba Empresas, RF017):** a aba lista as empresas filtradas por situação (aguardando, aprovadas,
  recusadas), com busca e todos os dados do cadastro. Aprovar libera a publicação de produtos. Recusar exige um motivo, e a
  empresa vê esse motivo na tela "aguardando" do web-empresa. Uma empresa recusada pode ser aprovada depois. Uma empresa aprovada
  não pode ser recusada por aqui, porque suspender empresa ainda não foi tratado. A gravação passa pela função
  `public.review_partner`, que só aceita admin.
- **Quem entra:** só `profiles.role = 'admin'`. A tela confere o papel, mas quem protege os dados são as regras de
  acesso (RLS) do banco (`private.is_admin()`), que já liberam a leitura de todas as empresas, reservas e perfis para admin.
- **Criar um admin** (rode você mesmo no SQL Editor do Supabase, trocando o e-mail; a conta precisa existir):
  `update public.profiles set role = 'admin' where email = 'SEU_EMAIL';`
  Se o banco recusar por causa de um gatilho que protege a coluna `role`, me avise.
- **Redirect URLs:** se for usar recuperação de senha, inclua `http://localhost:8200/**` em Authentication → URL Configuration.
- **Definições:** venda = reserva `picked_up`; usuário ativo = consumidor com ao menos uma reserva no período. O banco não
  guarda peso, então **não existe “kg salvos”** (o PRD pede): o painel mostra “itens salvos” (unidades vendidas).
- Como no painel da empresa, a receita só aparece depois que a empresa confirma a retirada.

### Pedidos: retirar no local ou delivery (mobile + web-empresa)

**Pré-requisito: rode no SQL Editor do Supabase, nesta ordem: `supabase/migrations/reservations_flow.sql`,
`reservations_fulfillment.sql` e `reservations_stages.sql`.** Sem eles, o "Confirmar pedido" do app e os botões de etapa
do web-empresa dão erro.

- **Checkout do app:** o cliente escolhe **Retirar no local**, que é grátis, tem prazo de 4 h (RN005) e mostra o endereço
  da loja, ou **Delivery**, que pede endereço e tem as opções padrão e expressa. Na retirada, a opção de dinheiro vira
  **"Pagar na retirada"**.
- **Banco (`create_reservation`):** grava o pedido com o tipo, o endereço, a forma de pagamento e o valor a cobrar
  (itens + taxa − cupom). Também confere a empresa aprovada, o produto ativo e o estoque, usa o preço do banco e baixa o estoque (RF011).
- **Etapas marcadas pela loja** (coluna `stage` e função `advance_reservation`):
  - retirada: Pedido recebido → **Separando o pedido** → **Pronto para retirar** → Retirado;
  - delivery: Pedido recebido → **Separando os produtos** → **Pedido a caminho** → Pedido entregue.

  A loja avança cada pedido no web-empresa. O avanço é só para frente, e a loja pode pular etapas (por exemplo, confirmar
  a retirada pelo código direto). O fim de cada fluxo continua sendo `picked_up`, que é o que os painéis contam como venda.
- **Acompanhamento no app:** nada é simulado. O app consulta o banco a cada 10 s e mostra a etapa atual, com o horário
  de cada uma. Também gera notificações ("Separando o seu pedido", "Pedido pronto para retirar!", "Saiu para entrega").
  - **retirada:** o código `FS-123456` aparece em destaque, junto com a loja, o botão "Como chegar" e o prazo;
  - **delivery:** mapa e etapas. A entrega é feita pela própria loja, então não há entregador com nome.

  Se a loja cancelar, o app mostra que o pedido foi cancelado pela loja. Pedidos feitos antes das reservas no banco
  continuam com a simulação antiga.
- **Web-empresa (aba "Pedidos", `/reservas`):**
  - mostra os pedidos em aberto e o histórico, com o tipo, o endereço de entrega e o que fazer com o pagamento
    ("Cobrar no balcão: R$ X", "Cobrar na entrega" ou "Pago no app");
  - cada pedido mostra a trilha de etapas e um botão com o próximo passo: **Começar a separar**, depois
    **Pronto para retirar** ou **Saiu para entrega**, e por fim **Confirmar retirada** ou **Confirmar entrega**. A
    confirmação marca `picked_up`, que é o que os dois painéis contam como venda;
  - o código digitado conclui o pedido direto, em qualquer etapa.
- **Cancelamento:** o cliente cancela uma retirada até 1 h antes do fim do prazo (RF012). Um delivery pode ser cancelado
  até a loja marcar "a caminho". A loja e o admin podem cancelar a qualquer momento. O estoque sempre volta.
- **Receita nos painéis:** só os itens. A taxa de entrega e o cupom servem apenas para a loja saber quanto cobrar.
- **Ainda não existe:**
  - cancelar sozinho as reservas vencidas (RN006 precisa de um job agendado);
  - checar se o e-mail foi confirmado (RN004);
  - mostrar o horário de funcionamento da loja.

### Comissão do FireStock (web-admin + web-empresa)

**Pré-requisito: rode `supabase/migrations/platform_commission.sql` no SQL Editor do Supabase**, depois de
`reservations_stages.sql`.

- **Regra:** o FireStock fica com uma porcentagem sobre o **valor dos produtos** de cada venda. A taxa de entrega,
  que é da loja, e o cupom ficam de fora. A taxa padrão começa em **10%**, e o admin pode dar uma **taxa especial**
  a uma loja.
- **A taxa fica gravada em cada venda** (`reservations.commission_percent` / `commission_cents`) no momento em que a loja
  confirma a retirada ou entrega (`confirm_pickup`). Mudar a taxa só vale para as próximas vendas; o histórico não muda.
  As vendas concluídas antes da migração receberam a taxa padrão.
- **Web-admin:**
  - o painel mostra a **Receita da plataforma** (soma das comissões) separada do **Volume vendido** (dinheiro das
    lojas), com um gráfico por dia e uma coluna de comissão no ranking;
  - na aba **Comissões** (`/comissoes`), o admin muda a taxa padrão e as taxas especiais. As funções
    `set_platform_commission` e `set_partner_commission` só aceitam admin.
- **Web-empresa:** o painel mostra **Vendas brutas**, **Comissão FireStock** (com a taxa atual) e **Valor líquido**.
- **Fora do escopo:** acerto financeiro de verdade. Hoje o Pix cai numa chave única, e na retirada a loja recebe na mão.
  Repasse e cobrança da comissão exigiriam um serviço de pagamento.

### Notificações de pedido: push no celular ou WhatsApp (mobile + Supabase)

O cliente escolhe em *Perfil → Preferências de notificação* como quer ser avisado quando a loja muda o pedido: **notificação no
celular**, **WhatsApp** (informando o número) ou **nenhum**. Quando a loja avança, confirma ou cancela um pedido, um gatilho do banco
grava o evento e chama a Edge Function `notify-order-status`, que envia pelo canal escolhido. O web-empresa não mudou.
- **Código pronto e testado só na lógica:** migration `supabase/migrations/notifications_delivery.sql` (validada com o analisador do
  PostgreSQL, **não executada**), Edge Function (`supabase/functions/`, 20 testes com `npm run test:functions`, tipos conferidos,
  **nunca publicada nem chamada de verdade**), tela e registro do aparelho no mobile (18 testes, empacota).
- **Depende de você** (contas e chaves): rodar a migration e criar o segredo no Vault, publicar a função, Firebase + novo APK para o push
  (não funciona no Expo Go/emulador/web) e conta da Meta com modelo aprovado para o WhatsApp. Passo a passo e custos em
  **`docs/NOTIFICACOES.md`**.
- **Regras:** o aviso é só para mudanças feitas pela loja ou pelo admin (quem cancela o próprio pedido não recebe); o canal padrão é
  push; escolher WhatsApp grava o aceite (`notification_consent_at`); sair da conta tira o aparelho da lista de push.

### Pix com QR Code real (mobile, `app/pix-payment.tsx`)

O "copia e cola" segue o padrão EMV do Banco Central (`utils/pix.ts`, com CRC-16) e o QR é desenhado de verdade
(`utils/qr.ts` + `components/ui/qr-code.tsx`, só com Views, sem módulo nativo). Configuração no `apps/mobile/.env.local`:
`EXPO_PUBLIC_PIX_KEY` (CPF/CNPJ só números, e-mail, telefone `+55...` ou chave aleatória), `EXPO_PUBLIC_PIX_NAME`,
`EXPO_PUBLIC_PIX_CITY`. Reinicie o Expo com `npx expo start -c` depois de mudar.
- **Sem chave:** usa uma chave de teste que não pertence a ninguém (o banco lê o QR, mas o dinheiro não vai a lugar nenhum)
  e a tela confirma sozinha após 7 s, como antes.
- **Com chave real:** quem pagar o QR transfere dinheiro de verdade para ela, e a tela só avança no botão "Já paguei".
- É um Pix **estático**: o app NÃO é avisado do pagamento. Confirmação automática exige uma API de pagamento (opção 2).
- Testes: `npm run test` em `apps/mobile` (CRC, campos, valores, matriz do QR).

## O que foi RECRIADO no mobile (o original não veio no pacote) — confira

Base: planos em `apps/mobile/docs/superpowers/plans/` (código de supabase, auth, viacep, mapbox, profile) e
o esquema do banco que você enviou. Onde não havia plano, escrevi a partir de como as telas chamam o serviço.

| Arquivo | Origem |
|---|---|
| `services/supabase.ts`, `auth-core.ts`, `auth.ts` | plano da migração (+ recuperação de senha) |
| `services/viacep.ts`, `mapbox.ts`, `profile.ts` | plano do ViaCEP/Mapbox/avatar (profile ampliado: nome, telefone, CPF, nascimento) |
| `services/user-data.ts` | **escrito do zero**: endereços, favoritos, cartões e avaliações (tabelas `addresses`, `favorites`, `payment_methods`, `order_reviews`) |
| `services/catalog.ts` | **escrito do zero**: empresas `approved` + produtos `active` não vencidos → telas |
| `services/google-auth.ts` | **escrito do zero**, não testado com o Google |
| `services/distance-core.ts`, `utils/sanitize.ts`, `utils/validation.ts` (`isValidName`, `isValidAddressNumber`) | **escritos do zero**; limites de tamanho e texto de distância são escolhas minhas |
| `utils/format, masks, seeded, share, currency, date, price-compare, validation` | branch `claude/wonderful-tesla-pppluq` do GitHub (26/set, podem estar atrás) |
| `package.json`, `tsconfig.json` | reconstruídos das versões que estavam em `node_modules` |

### Suposições a conferir
- Avatar: bucket `avatars`, caminho `{id-do-usuário}/avatar.ext` (vem do plano).
- CPF e telefone são gravados **só com dígitos** e exibidos com máscara.
- Produtos sem coluna de unidade aparecem como `un`; entrega usa valores neutros (20–40 min, taxa 0), porque o banco não guarda isso.
- Pedidos: o histórico e a simulação de entrega continuam no aparelho, mas cada pedido agora também é uma reserva no banco (ver "Pedidos: retirar no local ou delivery").
- A senha mínima do mobile é 6 (`MIN_PASSWORD_LENGTH`); o web-empresa exige 8.

### Fora do pacote
- `supabase/functions`: `welcome-email`, `partner-approved-email` e `delete-account` já rodam no Supabase
  (o banco chama as duas primeiras; `app/account.tsx` chama `delete-account`), mas o código delas não veio. Não mexi.
- Typecheck do mobile (`npm run typecheck:mobile`): ~50 erros só de TIPO de biblioteca
  (`ImageSource` do expo-image, `focus` do TextInput, `beforeRemove` do react-navigation). Não impedem o empacotamento;
  não investiguei se já existiam no original.

## Origem dos arquivos
- mobile: `Downloads/Projeto Firestok - Versão atualizada/projeto aplicativo(mobile)`
- web-empresa: `Downloads/web-empresa/web-empresa`
- Nada dos originais foi alterado ou apagado.
