import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward API calls to Express so the frontend can use relative URLs like /api/items
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
