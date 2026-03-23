import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@rapidtool/cad-core': path.resolve(__dirname, './packages/cad-core/src'),
      '@rapidtool/cad-ui': path.resolve(__dirname, './packages/cad-ui/src'),
    },
  },
  optimizeDeps: {
    include: [
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-slot',
      '@radix-ui/react-accordion',
    ],
  },
});
