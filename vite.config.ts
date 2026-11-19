import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Gera um único Vigencias.html com JS, CSS e fontes embutidos.
// Necessário para abrir por file:// a partir da pasta de rede, sem servidor e sem internet.
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { input: 'index.html' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
