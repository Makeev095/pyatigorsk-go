import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function normalizeBasePath(input: string) {
  let b = (input || '/').trim()
  if (!b.startsWith('/')) b = `/${b}`
  if (!b.endsWith('/')) b = `${b}/`
  return b
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBasePath(process.env.PWA_BASE || '/'),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/maskable.svg'],
      manifest: {
        name: 'Pyatigorsk GO',
        short_name: 'PyatigorskGO',
        description: 'Мини-игра PWA: ищи достопримечательности Пятигорска на карте.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        scope: normalizeBasePath(process.env.PWA_BASE || '/'),
        start_url: normalizeBasePath(process.env.PWA_BASE || '/'),
        orientation: 'portrait',
        lang: 'ru-RU',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,txt,woff2}'],
        navigateFallback: `${normalizeBasePath(process.env.PWA_BASE || '/')}` + 'index.html',
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
