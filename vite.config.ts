import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works on GitHub Pages sub-paths as well as Netlify/Vercel roots.
export default defineConfig({
  base: './',
  // Listen on the local network too, so a phone on the same Wi-Fi can open the dev/preview server.
  server: { host: true },
  preview: { host: true },
  // Older iPhones (iOS 15) still run the build.
  build: { target: ['es2020', 'safari15'] },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gardenly – kerttervező',
        short_name: 'Gardenly',
        description: 'Tervezz, ültess, élvezd: mobilbarát kerttervező – terület, növények, lista, évszakok.',
        lang: 'hu',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#fbf8f2',
        theme_color: '#133726',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
  },
});
