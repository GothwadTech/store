import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Import with explicit .ts extension for Vite's native config loader.
import { manifestFor, renderIndexHtml, resolveBrand } from './shared/brand.ts';
import type { Brand } from './shared/brand.ts';

/**
 * Single Cloudflare Pages build serving all 4 custom domains (kiwistore /
 * kiwiconsole / kiwiadmin / kiwiapp). Brand names and domains resolve from
 * shared/brand.ts and environment variables.
 * In local dev, /api is proxied to the local Wrangler Worker on port 8787.
 */
function brandPlugin(brand: Brand): Plugin {
  const manifest = () => `${JSON.stringify(manifestFor(brand), null, 2)}\n`;
  return {
    name: 'kiwi-brand',
    // Replace %TOKEN% placeholders in index.html using the resolved brand config.
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => renderIndexHtml(html, brand),
    },
    // Emit manifest.json dynamically from the resolved brand configuration.
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
  // Merge .env* files with process.env (Cloudflare Pages environment variables).
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
  };
});
