# FireStock PRD

## Visão Geral
FireStock é um marketplace para produtos próximos da data de validade. O sistema conecta estabelecimentos comerciais parceiros a consumidores interessados em comprar produtos com desconto, reduzindo desperdício e gerando valor para ambas as partes.

### Objetivos
- Reduzir desperdício de alimentos
- Oferecer produtos com desconto para consumidores
- Permitir que estabelecimentos gerenciem anúncios de produtos com validade próxima
- Fornecer controle administrativo para aprovação de parceiros e métricas

## Perfis de Usuário
- Consumidor
- Parceiro (Estabelecimento)
- Administrador

## Requisitos Funcionais Principais

### Autenticação e Cadastro
- RF001: Cadastro de Consumidor com nome completo, e-mail, senha, CPF e telefone.
- RF002: Cadastro de Parceiro com razão social, CNPJ, endereço completo, telefone, e-mail, categoria de estabelecimento e dados bancários.
- RF003: Login com e-mail e senha; recuperação de senha por e-mail; expiração de sessão por inatividade.
- RF004: Edição de perfil para consumidores e estabelecimentos.

### Produtos e Anúncios
- RF005: Parceiro cadastra produto/anúncio com nome, categoria, descrição, validade, quantidade, preço original, percentual de desconto, foto e código de barras opcional.
- RF006: Parceiro pode editar e remover anúncios; reservas pendentes são canceladas com notificação.
- RF007: Anúncios expiram automaticamente na data de validade.

### Busca e Navegação
- RF008: Listagem de produtos disponíveis com foto, nome, preço com desconto, percentual de desconto, data de validade, estabelecimento e distância aproximada.
- RF009: Filtros por categoria, data de validade, faixa de preço, desconto mínimo, tipo de estabelecimento e distância máxima.
- RF010: Tela de detalhe do produto com informações completas e botão de reserva.

### Reservas
- RF011: Consumidor reserva produto e estoque é decrementado.
- RF012: Consumidor cancela reserva até 1 hora antes da retirada.
- RF013: Parceiro confirma retirada via código ou manualmente.
- RF014: Histórico de reservas para consumidores e parceiros.

### Notificações
- RF015: Notificações para confirmação de reserva, lembrete de retirada, cancelamento, novos produtos favoritos e expiração de anúncio.

### Avaliações
- RF016: Consumidor avalia estabelecimento após reserva concluída; nota média exibida publicamente.

### Administrativo
- RF017: Administrador aprova/refusa cadastro de estabelecimentos.
- RF018: Painel de métricas para usuários ativos, reservas, kg salvos e receita.

## Requisitos Não Funcionais
- RNF001: Listagem de produtos carrega em no máximo 3 segundos em 4G.
- RNF002: Disponibilidade mínima de 99% ao mês.
- RNF003: Senhas com hash e dados sensíveis via HTTPS/TLS.
- RNF004: Proteção contra brute force após 5 tentativas.
- RNF005: Interface intuitiva para primeira reserva sem treinamento.
- RNF006: Acessibilidade WCAG 2.1 AA.
- RNF007: Suporta até 10.000 usuários simultâneos.
- RNF008: Código com testes e padrões documentados, cobertura mínima de 60%.
- RNF009: Compatível com diferentes tamanhos de tela.
- RNF010: Conformidade com LGPD: consentimento, exclusão e controle de dados.

## Regras de Negócio
- RN001: Apenas produtos com validade futura podem ser anunciados.
- RN002: Desconto entre 20% e 90%.
- RN003: Estoque zero mostra status "Esgotado".
- RN004: Consumidor só pode reservar com cadastro completo e e-mail confirmado.
- RN005: Retirada em até 4 horas ou horário de fechamento do estabelecimento.
- RN006: Reservas não retiradas são canceladas automaticamente e estoque restaurado.
- RN007: Consumidor com 3 não retiradas em 1 mês pode ser suspenso.
- RN008: Parceiros só publicam anúncios após aprovação administrativa.
- RN009: Avaliação só após reserva concluída.
- RN010: Medicamentos e suplementos não são permitidos no MVP.

## Gap de Implementação Atual
### O que já existe no app
- Tela inicial de boas-vindas
- Login com validação básica
- Cadastro de consumidor com senha e confirmação
- Tela de recuperação de senha
- Listagem de ofertas e mercados parceiros
- Carrinho, checkout e acompanhamento de pedido
- Navegação persistente e UI de perfil/minha conta
- Feed de notificações in-app (reserva, cancelamento, lembrete de retirada, favoritos com desconto, produtos vencendo)
- Avaliação de estabelecimento após confirmar retirada, com nota média exibida no mercado

### O que falta ser criado
- Persistência real de produtos e reservas (usuários e perfis já estão no Supabase)
- Cadastro de parceiro completo
- Aprovação e painel administrativo
- Gestão de anúncios de produtos pelo parceiro
- Funcionalidade real de reserva com estoque e códigos de retirada
- Histórico de reservas e pedidos
- Cancelamento de reserva com regras de prazo
- Confirmação de retirada por parceiro
- Notificações reais por e-mail/push (existe feed in-app: reserva, cancelamento, retirada, favoritos, expiração)
- Distinção de perfis de usuário (consumidor/parceiro/admin)
- LGPD e exclusão de conta
- Compatibilidade com categorias proibidas e regras de desconto

## Tarefas Prioritárias

### 1. Arquitetura e backend
- [x] Definir arquitetura de backend (Supabase Auth + Postgres/RLS, sem servidor próprio).
- [x] Modelar banco de dados relacional (usuários, parceiros, produtos, reservas, anúncios, avaliações).
- [ ] Implementar autenticação real e autorização de perfis.
- [ ] Adicionar suporte a e-mail de confirmação e recuperação de senha.

### 2. Fluxo de parceiros
- [ ] Criar cadastro de parceiro com CNPJ, razão social, endereço, telefone, categoria e dados bancários.
- [ ] Implementar aprovação de parceiro pelo administrador.
- [ ] Bloquear publicação de anúncios até aprovação.
- [ ] Criar página de perfil do parceiro.

### 3. Produtos e reservas
- [ ] Implementar criação/edição/remoção de anúncios pelo parceiro.
- [ ] Validar data de validade e impedir anúncios vencidos.
- [ ] Mostrar produtos com desconto, validade, estabelecimento e distância.
- [x] Implementar reserva de produto e decremento de estoque.
- [x] Adicionar cancelamento de reserva respeitando prazo.
- [ ] Registrar histórico de reserva para consumidor e parceiro.
- [x] Implementar notificações (reserva, retirada, cancelamento, favoritos, expiração).
- [x] Implementar avaliação de estabelecimento após retirada, com nota média exibida.

### 4. UI e navegação
- [ ] Adaptar o app para perfis de usuário diferentes.
- [ ] Criar telas de detalhe de produto com dados do estabelecimento.
- [x] Criar telas de histórico de reservas/pedidos.
- [ ] Adicionar filtros avançados na listagem de produtos.
- [ ] Criar dashboard administrativo e métricas.

### 5. Qualidade e conformidade
- [ ] Implementar testes automáticos para cobertura mínima de 60%.
- [ ] Adotar padrões de código e documentação de APIs.
- [ ] Garantir acessibilidade WCAG 2.1 AA.
- [ ] Implementar LGPD: consentimento, exclusão de conta e gerenciamento de dados.

## Próximos passos imediatos
1. Definir o escopo do backend e os modelos de dados.
2. Construir o fluxo de autenticação e perfis de usuário.
3. Implementar fluxo de cadastro e aprovação de parceiro.
4. Criar o módulo de anúncios e reserva de produtos.
