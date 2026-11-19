import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pacote from './package.json';

const versao = pacote.version;

// Gera um único Vigencias.html com JS, CSS e fontes embutidos.
// Necessário para abrir por file:// a partir da pasta de rede, sem servidor e sem internet.
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  // Versão embutida no HTML, usada para conferir atualizações (src/atualizacao/versao.ts).
  define: { __VERSAO_APP__: JSON.stringify(versao) },
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
