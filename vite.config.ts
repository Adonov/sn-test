/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from './server/api.js';

// Serves /api/* from the same process during `vite dev` and `vite preview`.
function apiPlugin(): Plugin {
  return {
    name: 'forkful-api',
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
  // The API middleware runs in this process, so give it ANTHROPIC_API_KEY from .env as well.
  const env = loadEnv(mode, process.cwd(), '');
  process.env.ANTHROPIC_API_KEY ??= env.ANTHROPIC_API_KEY;
  return {
    plugins: [react(), apiPlugin()],
    server: { host: true },
    test: {
      include: ['tests/**/*.test.ts'],
    },
  };
});
