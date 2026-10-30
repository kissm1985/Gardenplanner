import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };
import type { Plugin } from 'vite';

/**
 * Content Security Policy for the built app (not the dev server, whose React refresh needs an inline script).
 * Code, styles and fonts only from the app itself; data only from Wikipedia / Wikimedia (plant photos);
 * images may also be any https link the user typed for an own photo.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.wikipedia.org https://commons.wikimedia.org https://upload.wikimedia.org",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const csp = (): Plugin => ({
  name: 'gardenly-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// Relative base so the build works on GitHub Pages sub-paths as well as Netlify/Vercel roots.
export default defineConfig({
  base: './',
  // Version and build time, shown under About so you can tell which build a phone runs.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // Listen on the local network too, so a phone on the same Wi-Fi can open the dev/preview server.
  server: { host: true },
  preview: { host: true },
  // Older iPhones (iOS 15) still run the build.
  build: { target: ['es2020', 'safari15'] },
  plugins: [
    react(),
    csp(),
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
