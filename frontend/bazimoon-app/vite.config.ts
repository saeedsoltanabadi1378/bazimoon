import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { searchPages, sitemap } from './seo/render.ts'

// Writes the static search pages (/en/, /fa/, /en/<game>/, /fa/<game>/) and sitemap.xml, so Google
// has real text to index in both languages. Their Play links open the app (see readDeepLink).
function searchPagesPlugin(): Plugin {
  return {
    name: 'bazimoon-search-pages',
    apply: 'build',
    generateBundle() {
      for (const [fileName, source] of searchPages()) this.emitFile({ type: 'asset', fileName, source })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    searchPagesPlugin(),
    VitePWA({
      // A new version waits until the player taps "Update now" (see UpdatePrompt).
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Bazimoon',
        short_name: 'Bazimoon',
        description: 'Daily puzzles, word games, arcade games and Mafia nights with friends.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0D1A',
        theme_color: '#0B0D1A',
        lang: 'en',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell, game code and word lists are cached so solo games open offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The voice SDK chunk is large; let it into the cache rather than failing the build.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // The search pages are plain pages served by nginx, not part of the offline app.
        globIgnores: ['en/**', 'fa/**'],
        navigateFallback: '/index.html',
        // The API, SignalR and the admin console always go to the network.
        navigateFallbackDenylist: [/^\/api\//, /^\/hubs\//, /^\/admin/, /^\/(en|fa)(\/|$)/],
        cleanupOutdatedCaches: true,
        // Push and notification-click handlers live in public/push-sw.js.
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
