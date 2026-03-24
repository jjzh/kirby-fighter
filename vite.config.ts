import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@simulation': path.resolve(__dirname, 'src/simulation'),
      '@client': path.resolve(__dirname, 'src/client'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
