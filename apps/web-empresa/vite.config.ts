import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { SECURITY_HEADERS } from './security-headers.mjs';

export default defineConfig({
  plugins: [react()],
  server: { port: 8100, host: true },
  // `npm run preview` serve a build com os mesmos cabeçalhos de segurança da publicação.
  preview: { port: 8100, headers: SECURITY_HEADERS },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
