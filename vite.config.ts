import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Extension ke saath import karo - Vite ka native config loader isi ko support karta hai.
import { manifestFor, renderIndexHtml, resolveBrand } from './shared/brand.ts';
import type { Brand } from './shared/brand.ts';

/**
 * Ek hi Pages project - 4 custom domains (kiwistore / kiwiconsole / kiwiadmin /
 * kiwiapp). Naam + domains shared/brand.ts me hain aur env se override hote
 * hain, isliye domain change = sirf Pages/Worker env variable, code change nahi.
 * Dev me /api ko isi repo ke Worker (port 8787) par proxy karte hain.
 */
function brandPlugin(brand: Brand): Plugin {
  const manifest = () => `${JSON.stringify(manifestFor(brand), null, 2)}\n`;
  return {
    name: 'kiwi-brand',
    // index.html ke %TOKEN% brand se bharo (title, canonical, og:*, app name).
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => renderIndexHtml(html, brand),
    },
    // manifest.json generate hota hai (app name env se) - static copy nahi rakhte.
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: manifest() });
    },
    configureServer(server) {
      server.middlewares.use('/manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest());
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // .env* files + process.env (Pages environment variables isi me aati hain)
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, unknown>;
  const brand = resolveBrand(env);

  return {
    plugins: [react(), tailwindcss(), brandPlugin(brand)],
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
    preview: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  };
});
