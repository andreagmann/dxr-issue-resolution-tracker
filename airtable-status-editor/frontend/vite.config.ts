import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  // Proxies /api/* to backend during local dev only
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});