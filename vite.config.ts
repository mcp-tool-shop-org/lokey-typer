import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  base: '/lokey-typer/',
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib/public', import.meta.url)),
      '@lib-internal': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'LoKey Typer',
        short_name: 'LoKey',
        description: 'Practice typing speed and accuracy.',
        start_url: '/lokey-typer/',
        scope: '/lokey-typer/',
        display: 'standalone',
        background_color: '#09090b',
        theme_color: '#09090b',
        icons: [
          {
            src: '/lokey-typer/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: '/lokey-typer/logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/lokey-typer/logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/lokey-typer/logo-150.png',
            sizes: '150x150',
            type: 'image/png',
          },
          {
            src: '/lokey-typer/logo-44.png',
            sizes: '44x44',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
