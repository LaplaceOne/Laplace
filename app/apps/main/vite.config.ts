import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors out of the entry chunk so the app shell loads fast.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@solana') || id.includes('@wallet-standard') || id.includes('@noble')) return 'solana';
          if (id.includes('react-router')) return 'router';
          if (id.includes('react-dom') || id.includes('scheduler')) return 'react';
          if (id.includes('@iconify')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
});
