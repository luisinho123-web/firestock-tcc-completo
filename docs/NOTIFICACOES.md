# Notificações de pedido (push no celular ou WhatsApp)

Quando a loja muda o andamento de um pedido, o cliente recebe um aviso pelo canal que **ele escolheu** em
*Perfil → Preferências de notificação*: notificação no celular (push), WhatsApp, ou nenhum.

Avisos enviados: loja começou a separar · pedido pronto para retirar · saiu para entrega · retirado/entregue (pede avaliação) ·
cancelado pela loja ou pelo admin · reserva vencida. **Quem cancela o próprio pedido não recebe aviso** (já sabe).

## Como funciona

```
Loja (web-empresa) avança / confirma / cancela o pedido
        │  (advance_reservation, confirm_pickup, cancel_reservation: nada mudou no web-empresa)
        ▼
Gatilho do banco  reservations_queue_notification
        │  grava o evento em notification_outbox e chama a função (pg_net), com um segredo
        ▼
Edge Function  notify-order-status      lê profiles.notification_channel do cliente
        ├── "push"      → serviço de push do Expo → FCM → aparelho(s) do cliente  (tabela push_tokens)
        ├── "whatsapp"  → WhatsApp Cloud API (Meta), modelo aprovado → número do cliente (profiles.notify_phone)
        └── "none"      → não envia
```

O que está **pronto no código**: migration, Edge Function, tela de preferências, registro do aparelho, toque no aviso abre o pedido.
O que **depende de você** (contas e chaves que o código não pode criar): rodar a migration, publicar a função, Firebase + novo APK
(para o push) e conta da Meta com modelo aprovado (para o WhatsApp). Nada disso foi testado com serviços reais.

## 1. Banco de dados

1. No SQL Editor do Supabase, rode `supabase/migrations/notifications_delivery.sql` (pode rodar de novo sem problema).
2. Ainda no SQL Editor, crie o segredo que o banco usa para chamar a função (troque pelo valor aleatório que você escolher,
   com 32 caracteres ou mais; guarde-o, você vai usar o mesmo no passo 2):

   ```sql
   select vault.create_secret('COLE-AQUI-UM-VALOR-ALEATORIO-LONGO', 'notify_webhook_secret');
   ```

   Sem esse segredo os eventos só ficam guardados em `notification_outbox` e nada é enviado.

## 2. Publicar a Edge Function

Precisa do [Supabase CLI](https://supabase.com/docs/guides/cli) logado na sua conta. Na pasta `firestock-tcc-completo`:

```bash
supabase link --project-ref grvhxufpbvgvgurjaavb
supabase secrets set NOTIFY_WEBHOOK_SECRET=O-MESMO-VALOR-DO-PASSO-1
supabase functions deploy notify-order-status --no-verify-jwt
```

`--no-verify-jwt` é necessário porque quem chama é o banco, não um usuário; a proteção é o segredo no cabeçalho
`x-webhook-secret` (sem ele a função responde 401). Use o CLI (e não colar o código no painel): a função importa arquivos de
`supabase/functions/_shared`.

## 3. Push no celular

Requisitos do Expo/Android (confira o passo a passo atual na documentação do Expo, seção *Push notifications → Get credentials for
Android*, porque os menus mudam):

1. Crie um projeto no [Firebase](https://console.firebase.google.com) e adicione um app **Android** com o pacote `br.com.firestok.app`.
2. Baixe o `google-services.json`, coloque em `apps/mobile/` e acrescente em `apps/mobile/app.json`, dentro de `"android"`:
   `"googleServicesFile": "./google-services.json"`.
3. Envie a credencial do FCM V1 (chave de conta de serviço do Firebase) para o EAS: `eas credentials` → Android → Google Service Account.
4. Gere um **novo APK** (a biblioteca de notificações é nativa, o APK antigo não tem): `eas build -p android --profile preview`.
5. Instale no celular. **Não funciona** no Expo Go (Android), no emulador nem na versão web: nesses casos a tela de
   preferências mostra o motivo.

Ao entrar na conta, se o canal for "push", o app pede a permissão de notificações e registra o aparelho (`push_tokens`). Sair da conta,
ou trocar de canal, remove o aparelho da lista.

## 4. WhatsApp

Usa a API oficial (WhatsApp Business Cloud API, da Meta). Mensagem enviada pela empresa fora da janela de 24 h precisa ser um
**modelo (template) aprovado**.

1. Em [developers.facebook.com](https://developers.facebook.com), crie um app do tipo *Business* e adicione o produto **WhatsApp**.
2. Anote o **ID do número de telefone** e gere um **token de acesso** (o temporário dura 24 h; para uso contínuo crie um token
   permanente de usuário do sistema).
3. Crie um modelo com este nome e conteúdo (categoria *Utility*, idioma *Português (BR)*, uma variável):

   | Campo | Valor |
   |---|---|
   | Nome | `atualizacao_pedido` |
   | Corpo | `FireStock: {{1}}` |
   | Exemplo da variável | `Pedido pronto para retirar! Seu pedido #AB12CD está pronto na loja Mercado Central.` |

   Espere a aprovação (costuma ser rápida para modelos simples, mas não é imediata).
4. Cadastre os segredos na função:

   ```bash
   supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_TEMPLATE_NAME=atualizacao_pedido
   ```

   Opcionais: `WHATSAPP_TEMPLATE_LANG` (padrão `pt_BR`) e `WHATSAPP_API_VERSION` (padrão `v21.0`, atualize se a Meta aposentar essa versão).

Limites que você vai encontrar: o número de teste da Meta só envia para até alguns telefones cadastrados no painel; em produção a Meta
cobra pelas mensagens de modelo e exige verificação da empresa. Veja os preços e regras atuais no site da Meta antes de decidir.
Alternativas (Twilio, Z-API etc.) exigem trocar só o `sendWhatsApp` em `supabase/functions/notify-order-status/index.ts`.

## 5. Testar sem esperar um pedido

- Veja a fila: `select * from notification_outbox order by created_at desc limit 20;`
  (`processed_at` preenchido = resolvido; `last_error` explica falhas e `attempts` conta as tentativas).
- Reenvie o que ficou pendente (função fora do ar, erro do WhatsApp...):

  ```bash
  curl -X POST https://grvhxufpbvgvgurjaavb.supabase.co/functions/v1/notify-order-status \
    -H "Content-Type: application/json" -H "x-webhook-secret: SEU-SEGREDO" -d '{"flush": true}'
  ```

  Dá para agendar isso a cada minuto com o `pg_cron` (exemplo comentado no fim da migration).
- Fluxo completo: faça um pedido no app, avance a etapa no web-empresa e confira a fila e o aparelho/WhatsApp.
- Testar só o aparelho: pegue um token em `select token from push_tokens;` e use a ferramenta de teste em expo.dev/notifications.

## Privacidade (LGPD)

- Guardamos só o número em formato internacional e o aceite (`notification_consent_at`, gravado quando a pessoa escolhe WhatsApp).
  A tela avisa que, ao salvar, ela aceita receber mensagens neste número. Escolher "Não receber avisos" desliga os dois canais.
- A fila `notification_outbox` e os aparelhos `push_tokens` seguem as regras de acesso (RLS): o cliente só enxerga os próprios aparelhos
  e ninguém lê a fila pelo app.
- Os textos dos avisos citam só o nome da loja e o código do pedido, sem valores nem endereço.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Nada chega e a fila fica com `processed_at` vazio | Falta o segredo `notify_webhook_secret` no Vault, a função não foi publicada, ou o `NOTIFY_WEBHOOK_SECRET` da função é diferente |
| `last_error` = "WhatsApp não configurado" | Faltam `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` |
| `last_error` com "Template ..." | Nome do modelo errado ou ainda não aprovado |
| A tela diz que o Firebase não está configurado | Faltam o `google-services.json` e/ou um novo APK |
| A tela diz que a permissão está desligada | A pessoa negou; botão "Abrir ajustes do aparelho" |
| Push só chega com o app aberto | Falta a credencial FCM no EAS (passo 3.3) |
