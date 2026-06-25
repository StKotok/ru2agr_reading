import { readFileSync } from 'fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  base: './',
  // Статика приложения (data, fonts, styles, icon) живёт в assets/
  // и копируется в dist/ как есть.
  publicDir: 'assets',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Не вставляем авто-регистрацию — мы используем Workbox напрямую в app.js,
      // чтобы иметь доступ к wb.update() для принудительной проверки обновлений.
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Греческая читалка Нового Завета',
        short_name: 'Читалка НЗ',
        start_url: './index.html',
        display: 'standalone',
        background_color: '#FAF7F2',
        theme_color: '#3D5A80',
        icons: [
          {
            src: './icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB for lexicon core
        globIgnores: [
          '**/data/originals/**',
          '**/data/translations/**',
          '**/data/align/**',
          '**/data/bibles/**',
          '**/data/lexicon/**'
        ],
        runtimeCaching: [
          {
            // Book packs and alignments — content-addressed by manifest version
            urlPattern: /\/data\/(bibles|align)\/.*\.json(?:\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'book-packs-v2',  // KEEP IN SYNC with app.js
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /\/data\/lexicon\/.*\.json(?:\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lexicon-data-v2',  // KEEP IN SYNC with app.js
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ]
});
