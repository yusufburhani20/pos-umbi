import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        owner: resolve(import.meta.dirname, 'owner.html'),
        cashier: resolve(import.meta.dirname, 'cashier.html')
      }
    }
  }
});
