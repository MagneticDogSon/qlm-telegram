import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function spaFallback() {
  return {
    name: 'spa-fallback',
    closeBundle() {
      const index = path.resolve('dist/index.html');
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, path.resolve('dist/404.html'));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallback()],
  server: {
    port: 3000,
    strictPort: true,
    host: '::',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        timeout: 120000,
        configure(proxy) {
          proxy.on('error', () => {
            /* API briefly down during tsx restart */
          });
        },
      },
    },
    watch: {
      ignored: [
        '**/src/server.ts',
        '**/src/bot/**',
        '**/src/loadEnv.ts',
        '**/src/telegramProxy.ts',
        '**/src/store.ts',
        '**/src/ingest/**',
        '**/src/qlm/**',
        '**/scripts/**',
        '**/data/**',
        '**/.env',
      ],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
