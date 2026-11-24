// Generates the HTML e-mails from supabase/functions/welcome-email/layout.mjs:
//   node docs/emails/build.mjs
// - confirm-signup.html / reset-password.html: paste into Supabase → Authentication → Emails → Templates
//   (they use the Go-template variables Supabase fills in, e.g. {{ .ConfirmationURL }}).
// - welcome.html: preview of the welcome e-mail sent by the `welcome-email` Edge Function (not a Supabase template).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { button, heading, layout, note, paragraph, welcomeEmail } from "../../supabase/functions/welcome-email/layout.mjs";

const out = dirname(fileURLToPath(import.meta.url));


const confirmSignup = layout({
  preheader: "Falta só um passo: confirme seu e-mail para ativar sua conta.",
  content: [
    heading("Confirme seu e-mail"),
    paragraph("Obrigado por criar sua conta no FireStock! Para ativá-la, confirme que este endereço de e-mail é seu."),
    button("Confirmar meu e-mail", "{{ .ConfirmationURL }}"),
  ].join("\n"),
  footerNote: "Se você não criou uma conta no FireStock, pode ignorar este e-mail com segurança.",
});

const resetPassword = layout({
  preheader: "Use o link para criar uma nova senha. Ele vale por tempo limitado.",
  content: [
    heading("Redefinir sua senha"),
    paragraph("Recebemos um pedido para redefinir a senha da sua conta no FireStock. Toque no botão abaixo para criar uma nova senha."),
    button("Criar nova senha", "{{ .ConfirmationURL }}"),
    note("Não foi você? Ignore este e-mail: sua senha continua a mesma."),
  ].join("\n"),
  footerNote: "Por segurança, o link de redefinição expira em pouco tempo e só pode ser usado uma vez.",
});

writeFileSync(join(out, "confirm-signup.html"), confirmSignup);
writeFileSync(join(out, "reset-password.html"), resetPassword);
writeFileSync(join(out, "welcome.html"), welcomeEmail({ name: "Fernando", appUrl: "https://app.firestok.com.br" }));
console.log(`E-mails gerados em ${out}`);
