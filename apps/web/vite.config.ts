import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hazop/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@hazop/utils': path.resolve(__dirname, '../../packages/utils/src/index.ts'),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
  },
});
