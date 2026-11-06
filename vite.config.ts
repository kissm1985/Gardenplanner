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
/** Servers set at build time: the statistics endpoint (VITE_ANALYTICS_URL) and the Pro backend (VITE_API_ORIGIN). */
const EXTRA_CONNECT = [process.env.VITE_ANALYTICS_URL, process.env.VITE_API_ORIGIN].filter((u): u is string => !!u).map((u) => new URL(u).origin);

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.wikipedia.org https://commons.wikimedia.org https://upload.wikimedia.org${EXTRA_CONNECT.map((o) => ` ${o}`).join('')}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/**
 * Security headers for hosts that let us set them (Netlify / Cloudflare Pages: dist/_headers, Vercel: vercel.json).
 * Only a real header can forbid framing (frame-ancestors is ignored in a <meta> CSP); the meta tag stays as a
 * fallback for hosts without headers (e.g. GitHub Pages).
 */
export const SECURITY_HEADERS: [string, string][] = [
  ['Content-Security-Policy', `${CSP}; frame-ancestors 'none'`],
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'no-referrer'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
];

const csp = (): Plugin => ({
  name: 'planterra-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: `/*\n${SECURITY_HEADERS.map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n` });
  },
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
  // The preview server sends the same headers as production, so the e2e tests run under them.
  preview: { host: true, headers: Object.fromEntries(SECURITY_HEADERS) },
  // Older iPhones (iOS 15) still run the build. Pictograms stay separate files (cached by the service worker)
  // instead of being inlined into the JavaScript as base64.
  build: { target: ['es2020', 'safari15'], assetsInlineLimit: (file: string) => (file.includes('/pictograms/') ? false : undefined) },
  plugins: [
    react(),
    csp(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Planterra – garden planner',
        short_name: 'Planterra',
        description: 'Planterra – garden design software: areas, plants, lists, seasons, visualisation.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f4ec',
        theme_color: '#244b3c',
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
