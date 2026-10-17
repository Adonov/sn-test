/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from './server/api.js';

// Serves /api/* from the same process during `vite dev` and `vite preview`.
function apiPlugin(): Plugin {
  return {
    name: 'receptko-api',
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

export default defineConfig({
  plugins: [react(), apiPlugin()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
