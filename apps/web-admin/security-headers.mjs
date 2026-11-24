// Cabeçalhos de segurança para PUBLICAR o site (fonte única). Usados por:
//   - `npm run preview` (vite.config.ts), para testar a build com os cabeçalhos reais;
//   - `npm run headers` (scripts/gen-headers.mjs), que gera public/_headers (Netlify/Cloudflare Pages), vercel.json
//     e deploy/nginx-security-headers.conf. Rodado automaticamente antes do `npm run build`.
// Em desenvolvimento (`npm run dev`) nada disso é aplicado, porque o Vite injeta scripts inline para o hot reload.

// Projeto Supabase usado pelo site (REST, Auth, Storage e Edge Functions).
export const SUPABASE_ORIGIN = 'https://grvhxufpbvgvgurjaavb.supabase.co';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // React aplica `style={{…}}` pelo CSSOM (permitido); atributos `style` escritos direto no HTML precisam do -attr.
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  // Fotos de produto e logo vêm do Storage do Supabase; blob:/data: são as pré-visualizações de upload.
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
  "font-src 'self'",
  // Só a API do Supabase (o painel admin não consulta CEP).
  `connect-src 'self' ${SUPABASE_ORIGIN}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  // HTTPS obrigatório por 1 ano, inclusive subdomínios (só vale quando o site é servido por HTTPS).
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
