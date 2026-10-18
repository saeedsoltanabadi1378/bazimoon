import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Writes /fa/index.html: the same app shell with Persian search and share tags (from seo-fa.html),
// so Google can index a Persian page. The app opens in Persian on /fa (see LanguageContext).
function persianLandingPage(): Plugin {
  return {
    name: 'bazimoon-persian-landing-page',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['index.html']
      if (!page || page.type !== 'asset') return
      const html = String(page.source)
      const block = /<!-- seo:start[\s\S]*?<!-- seo:end -->/
      if (!block.test(html)) throw new Error('index.html is missing the seo:start / seo:end markers')
      const faHead = readFileSync(new URL('./seo-fa.html', import.meta.url), 'utf8').trimEnd()
      const faHtml = html
        .replace('<html lang="en">', '<html lang="fa" dir="rtl">')
        .replace(block, () => faHead.trimStart())
        .replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>
      <h1>بازیمون</h1>
      <p>پازل‌های روزانه رایگان (زیپ، ملکه‌ها، سودوکو، کلمه روز)، بازی‌های آرکید، تخته‌نرد و شب‌های مافیا با دوستان، به فارسی و انگلیسی. برای بازی، جاوااسکریپت را روشن کنید.</p>
    </noscript>`)
      this.emitFile({ type: 'asset', fileName: 'fa/index.html', source: faHtml })
      // The English page keeps its markers out of the shipped HTML.
      page.source = html.replace(/ *<!-- seo:(start|end)[^>]*-->\n?/g, '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    persianLandingPage(),
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
        navigateFallback: '/index.html',
        // The API, SignalR and the admin console always go to the network.
        navigateFallbackDenylist: [/^\/api\//, /^\/hubs\//, /^\/admin/],
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
