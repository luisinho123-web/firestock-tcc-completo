# web-empresa — painel da empresa parceira (design)

Data: 19/10/2026 · Escopo: primeira etapa do lado "empresa" do FireStock. O web-admin e a leitura de produtos pelo
app ficam para etapas seguintes (ver "Fora do escopo").

## Intenção

O FireStock é um marketplace de produtos **perto do vencimento**, vendidos com desconto (ver `FireStock-PRD.md`). Hoje
os mercados e produtos do app são dados fixos no código. Para o app ter oferta de verdade, as empresas parceiras
precisam de um lugar para **se cadastrar e publicar os próprios anúncios**. A `web-empresa` é esse lugar: um site
simples em que a dona ou o dono de um mercado entra, cadastra o produto que está perto de vencer, com foto, validade,
quantidade e desconto, e pronto.

Sucesso: uma empresa se cadastra, é aprovada, publica um produto em poucos minutos sem treinamento (RNF005) e esse
produto fica gravado no Supabase exatamente como o app vai ler depois.

## Objetivos

- Cadastro e login da empresa (e-mail e senha), com recuperação de senha.
- Cadastro dos dados da empresa e estado de aprovação (pendente, aprovada, recusada), como no PRD (RF002, RF017, RN008).
- Gestão de produtos pela empresa aprovada: listar, buscar, filtrar, cadastrar, editar, pausar e remover (RF005, RF006).
- Regras de negócio do PRD aplicadas **no banco**, não só na tela (RN001, RN002, RN003, RN008, RN010).
- Mesma identidade visual do app.

## Fora do escopo (desta etapa)

- **web-admin**: aprovar ou recusar empresas e métricas. Nesta etapa, quem aprova é o dono do projeto, direto no
  banco (eu faço isso durante os testes). O web-admin é a etapa seguinte.
- **O app lendo produtos do banco** (troca de `data/products.ts` e `data/partners.ts`). É a etapa 2, porque o app hoje
  não tem validade nem desconto e muitas telas dependem dos dados fixos.
- Reservas, retirada por código, pedidos, notificações reais, avaliações, relatórios e estoque detalhado.
- Mais de um usuário por empresa. Dados bancários (`partner_bank_accounts`): não são necessários para publicar anúncio,
  entram depois.
- Aplicativo móvel para a empresa.

## O que não pode acontecer (anti-objetivos)

- Uma empresa se aprovar sozinha ou editar status, avaliação ou quem aprovou.
- Uma empresa não aprovada publicar produto, ou uma empresa mexer em produto de outra.
- Cadastro de usuário comum virar administrador por conta própria.
- Produto com validade no passado, desconto fora de 20–90%, ou categoria proibida (medicamentos e suplementos).
- Chaves secretas dentro do site: ele usa só a chave pública (publishable) do Supabase.

## O que já existe e será reaproveitado

No projeto Supabase `grvhxufpbvgvgurjaavb` já existem, com RLS ligada:

- `partners`: `owner_id`, `legal_name`, `trade_name`, `cnpj`, `category`, contato, endereço, `status`
  (`pending` | `approved` | `rejected`), `rejection_reason`, `approved_at`, `approved_by`.
- `products`: `partner_id`, `category_id`, `name`, `description`, `image_url`, `barcode`, `original_price_cents`,
  `discount_percent`, `price_cents`, `quantity`, `expires_at`, `status` (`active` | `expired` | `removed`).
- `categories`: 10 categorias (mercearia, padaria, laticínios, carnes e frios, hortifrúti, bebidas, congelados,
  higiene, limpeza, pet), leitura pública.
- `profiles.role`: `consumer` | `partner` | `admin`, e a função `private.is_admin()`.
- Políticas atuais: a empresa insere o próprio cadastro só como `pending`; só empresa **aprovada** insere, edita e
  apaga produto; o público só vê produto `active`, não vencido, de empresa aprovada.
- Autenticação por e-mail e senha com **confirmação de e-mail ligada** e envio pelo Resend (já configurado).

## Lacunas no banco que esta etapa corrige (migrações)

1. **Brecha de autoaprovação.** A política `partners_update` deixa o dono alterar a própria linha inteira. Um gatilho
   `BEFORE UPDATE` em `partners` deve impedir que quem não é admin altere `status`, `rejection_reason`, `approved_at`,
   `approved_by`, `owner_id`, `rating_avg` e `rating_count`.
2. **Regras do PRD como restrições no banco** em `products`: desconto entre 20 e 90; `quantity >= 0`; preço original
   maior que zero; `price_cents` calculado a partir de preço original e desconto (gatilho, para não depender do
   navegador); validade futura **na criação** e na troca de validade (RN001), sem bloquear a edição de produto que
   venceu depois.
3. **Fotos.** Bucket público de leitura `product-images`; só o dono de empresa **aprovada** grava, altera e apaga, e só
   dentro da pasta com o `id` da própria empresa (`{partner_id}/...`). Limite de tamanho e só JPEG, PNG e WebP.
4. **Papel `partner`.** O cadastro pela web-empresa deve resultar em `profiles.role = 'partner'`, e o cadastro nunca
   pode escolher `admin`. A forma exata depende de como o gatilho atual de criação de perfil funciona (o builder deve
   ler a função antes de mexer).

## Como funciona (fluxo da empresa)

Com a confirmação de e-mail ligada, não há sessão logo após o cadastro, então o cadastro é em **duas etapas**
(decisão minha, ver abaixo):

1. **Criar acesso**: nome do responsável, e-mail e senha. O site avisa para confirmar o e-mail.
2. **Entrar** e, se ainda não houver empresa vinculada, preencher **Dados da empresa**: razão social, nome fantasia,
   CNPJ (validado), telefone, e-mail de contato, categoria do estabelecimento e endereço completo (CEP com preenchimento
   automático pelo ViaCEP, que o app já usa).
3. **Aguardando aprovação**: tela com o estado. Se recusada, mostra o motivo (`rejection_reason`). Só empresa aprovada
   vê a área de produtos.
4. **Produtos** (empresa aprovada): lista com foto, nome, categoria, preço com desconto, validade, quantidade e estado
   ("Ativo", "Esgotado", "Vencido", "Pausado"), com busca por nome e filtro por categoria e estado.
5. **Novo produto / editar produto**: nome, categoria, descrição, validade, quantidade, preço original, desconto
   (20–90) com o **preço final mostrado ao digitar**, foto com pré-visualização e código de barras opcional.
6. **Pausar** (produto volta a poder ser ativado) e **remover** (com confirmação). Remover é "exclusão lógica":
   `status = 'removed'`, preservando o histórico para as reservas futuras.
7. **Sair** e **recuperar senha** (mesmo fluxo e mesmos e-mails do app).

Estado "Esgotado" = `quantity = 0` (RN003). "Vencido" = `expires_at` no passado (RF007): o público já não enxerga
pelas políticas, e a lista da empresa mostra o rótulo calculado.

## Visual

Segue o app (`components/ui/theme.ts`): azul-marinho `#000851`, laranja `#F05219`, fundo `#F8FAFC`, superfícies brancas,
cantos arredondados (14/16/20), fonte do sistema, sucesso `#16A34A` e erro `#DC2626`. Logo oficial (horizontal, colorida,
em `Projeto FireStok/identidade`, já exportada em `docs/emails/logo-firestock.png`). Layout de desktop: barra superior
com logo, nome da empresa e "Sair"; conteúdo com largura máxima. Em celular também deve funcionar. Textos em
português do Brasil, mensagens de erro claras e iguais às do app.

## Decisões

**Do dono do projeto:** seguir o PRD (produto perto do vencimento com desconto); visual igual ao do app; empresa
se cadastra e é aprovada no admin, ou o dono cria a conta; primeiro a web-empresa, testada.

**Minhas (marcadas como palpites, podem ser trocadas):**
- React + Vite + TypeScript + React Router + `@supabase/supabase-js`, CSS próprio com os tokens do app (sem biblioteca
  de componentes). Fica em `Documents/teste-app/web-empresa`, ao lado do app.
- Porta de desenvolvimento **8100**; variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local`
  (mesmo projeto Supabase do app).
- Cadastro em duas etapas (acesso, depois dados da empresa) por causa da confirmação de e-mail.
- Remover produto = exclusão lógica (`status = 'removed'`).
- Dados bancários e vários usuários por empresa ficam fora desta etapa.
- Sem dados de demonstração: o banco continua vazio de empresas e produtos; o app só passa a usá-los na etapa 2.
- Aprovação durante os testes feita por mim no banco, até existir o web-admin.

## Testes e como saber que funciona

- **Lógica pura** (CNPJ, cálculo do preço final, validações de produto e de formulário): testes automatizados.
- **Regras no banco**: verificar com consultas simulando papéis (anônimo, empresa pendente, empresa aprovada, outra
  empresa, admin) que cada tentativa proibida na lista de anti-objetivos é **recusada** e as permitidas funcionam.
- **Navegador de verdade**: cadastrar uma empresa de teste (e-mails de teste na caixa do dono do projeto, por exemplo
  `cavalheiro242+empresa1@gmail.com`), confirmar o e-mail, entrar, preencher a empresa, ver "aguardando aprovação",
  aprovar no banco, cadastrar produto com foto, editar, pausar, remover, e conferir que a consulta pública (a mesma que
  o app fará) só devolve o que deve. Depois, limpar os dados de teste.
- Build de produção e checagem de tipos sem erros.

## Pontos que dependem do dono do projeto

- Adicionar `http://localhost:8100/**` (e depois o endereço publicado da web-empresa) em **Authentication → URL
  Configuration → Redirect URLs** no Supabase, para os links de e-mail voltarem ao site.
- Autorizar o uso de e-mails `+empresaN` do Gmail nos testes (os e-mails de confirmação chegam na caixa dele).

## O que fica a cargo de quem implementa

Estrutura de pastas, nomes de componentes, estilo das mensagens, detalhes visuais dentro dos tokens, e a forma exata de
fazer o papel `partner` valer no cadastro (depois de ler o gatilho atual de perfis).

## Ajustes feitos durante a implementação (19/10/2026)

- **A "brecha de autoaprovação" não existia.** O banco já tinha o gatilho `protect_partner_columns`, que bloqueia a
  empresa de alterar `status`, aprovação e avaliação. Só a política de UPDATE, lida sozinha, dava a impressão contrária.
  Também já existiam as restrições de desconto, quantidade, preço e CNPJ; a migração `web_empresa_rules` só acrescentou
  validade futura, o papel `partner` e o bucket de fotos.
- **"Pausar" ficou de fora.** O modelo do banco só tem `active`, `expired` e `removed`; a web-empresa oferece editar
  (inclusive zerar a quantidade, que vira "Esgotado") e remover.
- O preço final usa divisão inteira, igual à coluna gerada `price_cents` (R$ 10,99 com 30% = R$ 7,69).
