/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from './server/api.js';

// Serves /api/* from the same process during `vite dev` and `vite preview`.
function apiPlugin(): Plugin {
  return {
    name: 'taisty-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) handleApi(req, res);
        else next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) handleApi(req, res);
        else next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // The API middleware runs in this process, so give it the server keys from .env as well.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['ANTHROPIC_API_KEY', 'STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_CALLBACK_DOMAIN']) {
    // process.env turns undefined into the string "undefined", so only copy values that are set.
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [react(), apiPlugin()],
    server: { host: true },
    test: {
      include: ['tests/**/*.test.ts'],
    },
  };
});
