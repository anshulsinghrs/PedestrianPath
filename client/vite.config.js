import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site under /<repo>/, so the asset base needs
// that prefix there. Vercel (and local dev) serve from /. Vercel sets
// VERCEL=1 in its build env, so flip the base on that without breaking
// the GitHub Pages deploy already in production.
const isVercel = process.env.VERCEL === '1';

export default defineConfig({
  base: isVercel ? '/' : '/PedestrianPath/',
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api requests to the backend so we don't hit CORS in dev
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
