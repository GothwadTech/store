import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Ek hi Pages project - 4 custom domains (store / console / admin.console / storeapp)
// Dev me /api ko isi repo ke Worker (port 8787) par proxy karte hain.
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
