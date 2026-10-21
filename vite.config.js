import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { localServer } from './scripts/local-server.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: { include: ['tests/unit/**/*.test.js'] },
  build: {
    target: 'es2020',
    rolldownOptions: {
      input: { main: 'index.html', privacy: 'privacy.html' },
    },
  },
  plugins: [
    localServer(), // npm run dev only: /admin and /api on this computer
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'TruthSpin: Truth or Dare',
        short_name: 'TruthSpin',
        description: 'Truth and dare with a spinning bottle. Free, no sign-up, works offline.',
        start_url: '/?ref=app',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#15112b',
        theme_color: '#15112b',
        categories: ['games', 'entertainment', 'social'],
        lang: 'en',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The whole game, including every question file, is saved on the phone after the first visit.
        globPatterns: ['**/*.{js,css,html,json,svg,png,webmanifest}'],
        globIgnores: ['og.jpg', 'icon-512.png', 'icon-maskable-512.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/, /^\/privacy/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
