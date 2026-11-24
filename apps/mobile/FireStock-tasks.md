# FireStock Task List

## Planejamento inicial
- [x] Revisar o PRD e confirmar escopo com as necessidades do FireStock.
- [x] Definir arquitetura de backend e tecnologias a serem usadas. (Supabase: Auth + Postgres com RLS, acesso direto do app)
- [x] Modelar o banco de dados relacional. (11 tabelas em `public`; ver `docs/superpowers/specs/2026-09-28-supabase-migration-design.md`)

## Autenticação e usuários
- [x] Criar cadastro de consumidor com validação de campos.
- [x] Implementar login com e-mail e senha.
- [x] Adicionar recuperação de senha por e-mail.
- [ ] Implementar confirmação de e-mail e sessão expirada.
- [x] Criar perfil de usuário para edição de dados.
- [ ] Separar perfis: consumidor, parceiro e administrador.

## Parceiros e anúncios
- [ ] Criar fluxo de cadastro de parceiro com CNPJ, razão social, endereço e dados bancários.
- [ ] Implementar aprovação de parceiro pelo administrador.
- [ ] Bloquear publicação de anúncios até parceiro aprovado.
- [ ] Criar UI de anúncios para parceiros.
- [ ] Implementar edição e remoção de anúncios.
- [ ] Adicionar validação de data de validade e regra de desconto.

## Produtos e busca
- [x] Exibir listagem de produtos disponíveis com imagem, preço, desconto e validade.
- [ ] Adicionar filtro por categoria, validade e desconto.
- [ ] Adicionar busca por mercado e produto.
- [ ] Criar tela de detalhes do produto com informações completas.
- [ ] Mostrar distância aproximada e horário de funcionamento do estabelecimento.

## Reservas e carrinho
- [x] Implementar reserva de produto e decremento de estoque.
- [x] Adicionar código de retirada para reserva confirmada.
- [x] Permitir cancelamento de reserva até 1 hora antes.
- [ ] Implementar confirmação de retirada pelo parceiro.
- [ ] Criar histórico de reservas e pedidos para consumidor e parceiro.

## Notificações e avaliações
- [x] Implementar notificações de reserva, retirada e expiração.
- [x] Adicionar notificações de novos produtos favoritos.
- [x] Implementar avaliação de estabelecimento após reserva concluída.
- [x] Exibir nota média do estabelecimento no perfil.

## Administrativo
- [ ] Criar dashboard de métricas para administrador.
- [ ] Exibir total de usuários, estabelecimentos ativos, reservas e kg salvos.
- [ ] Permitir aprovação/reprovação de parceiros com motivo.
- [ ] Implementar controle de suspensão de consumidores por reserva não retirada.

## Qualidade e conformidade
- [ ] Implementar testes automatizados e verificar cobertura.
- [ ] Garantir acessibilidade WCAG 2.1 AA.
- [ ] Adotar HTTPS/TLS e proteção de senhas.
- [ ] Implementar LGPD: consentimento e exclusão de dados.

## MVP mínimo recomendado
- [x] Consumidor: cadastro, login, ver ofertas, reservar produto.
- [ ] Parceiro: cadastro, aprovação, publicar anúncio.
- [ ] Sistema: expiração automática de anúncios, histórico de reservas, checkout/reserva.
