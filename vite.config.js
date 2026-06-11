import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg'],
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
        globIgnores: ['**/data/bibles/**'],
        runtimeCaching: [
          {
            urlPattern: /\/data\/bibles\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'bible-data',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /\/data\/lexicon\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lexicon-data',
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ]
});
