import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // For GitHub Pages (project site): https://<user>.github.io/<repo>/
  base: process.env.GITHUB_ACTIONS ? '/azure-voice-live-interpreter/' : '/',
  plugins: [react()],
  define: {
    'process.env': {},
    'global': 'globalThis',
    'Buffer': 'Buffer',
  },
  resolve: {
    alias: {
      'process': 'process/browser',
      'buffer': 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'process'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
