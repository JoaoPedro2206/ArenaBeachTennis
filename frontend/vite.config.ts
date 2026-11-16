import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Proxy de desenvolvimento: o navegador chama "/api/..." na mesma origem do
 * Vite e o Vite repassa ao backend. Assim não há CORS no dev e a porta do
 * frontend pode mudar (5173, 5174...) sem mexer no backend.
 */
const backendUrl = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3333';
const apiProxy = {
  '/api': { target: backendUrl, changeOrigin: true },
  // Fotos enviadas (em dev ficam no disco do backend; em produção, URL do S3/CDN)
  '/uploads': { target: backendUrl, changeOrigin: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
});
