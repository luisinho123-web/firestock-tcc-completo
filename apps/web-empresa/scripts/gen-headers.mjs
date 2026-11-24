// Gera, a partir de security-headers.mjs, os arquivos de cabeçalhos de cada tipo de hospedagem:
//   public/_headers                         -> Netlify e Cloudflare Pages (vai para dist/ no build)
//   vercel.json                             -> Vercel
//   deploy/nginx-security-headers.conf      -> nginx (incluir dentro do bloco `server`)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SECURITY_HEADERS } from '../security-headers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lines = (headers, indent) => Object.entries(headers).map(([name, value]) => `${indent}${name}: ${value}`).join('\n');

// Arquivos com hash no nome (assets/*) nunca mudam: cache longo. O index.html sempre revalida.
const CACHE_ASSETS = 'public, max-age=31536000, immutable';
const CACHE_HTML = 'no-cache';

mkdirSync(join(root, 'public'), { recursive: true });
mkdirSync(join(root, 'deploy'), { recursive: true });

writeFileSync(
  join(root, 'public', '_headers'),
  `# Gerado por scripts/gen-headers.mjs — não editar à mão.\n/*\n${lines(SECURITY_HEADERS, '  ')}\n  Cache-Control: ${CACHE_HTML}\n\n/assets/*\n  Cache-Control: ${CACHE_ASSETS}\n`,
);

const toVercel = (headers) => Object.entries(headers).map(([key, value]) => ({ key, value }));
writeFileSync(
  join(root, 'vercel.json'),
  JSON.stringify(
    {
      rewrites: [{ source: '/((?!assets/).*)', destination: '/index.html' }],
      headers: [
        { source: '/(.*)', headers: [...toVercel(SECURITY_HEADERS), { key: 'Cache-Control', value: CACHE_HTML }] },
        { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: CACHE_ASSETS }] },
      ],
    },
    null,
    2,
  ) + '\n',
);

const nginx = Object.entries(SECURITY_HEADERS)
  .map(([name, value]) => `add_header ${name} "${value.replace(/"/g, '\\"')}" always;`)
  .join('\n');
writeFileSync(
  join(root, 'deploy', 'nginx-security-headers.conf'),
  `# Gerado por scripts/gen-headers.mjs — não editar à mão.\n# Use dentro do bloco server { ... }:  include /caminho/nginx-security-headers.conf;\n# Atenção: add_header em um bloco location substitui os do server; repita o include nele se usar location.\n${nginx}\n`,
);

console.log('Cabeçalhos gerados: public/_headers, vercel.json, deploy/nginx-security-headers.conf');
