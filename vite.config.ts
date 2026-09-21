// `vitest/config` (et non `vite`) : c'est lui qui type la clé `test` ci-dessous.
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Content-Security-Policy stricte du site déployé. GitHub Pages étant statique,
// elle ne peut pas être posée en en-tête HTTP : on l'injecte via <meta>.
const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://www.civix.fr",
  "img-src 'self'",
  "style-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

// Injecte la CSP uniquement au build (apply: 'build'), pour ne pas contraindre
// le serveur de dev / HMR (Vite injecte des <style> inline en développement).
function injectCsp(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

// Site projet GitHub Pages servi sous /fuck-medias/
export default defineConfig({
  base: '/fuck-medias/',
  plugins: [react(), injectCsp()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
})
