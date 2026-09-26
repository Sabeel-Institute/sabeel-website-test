// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Canonical origin, used for absolute Open Graph URLs (link previews in
  // WhatsApp, Instagram, email). Change this when the site moves domains.
  site: 'https://sabeel-website-test.web.app',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  image: { layout: 'constrained' },
  vite: { plugins: [tailwindcss()] },
});
