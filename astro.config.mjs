// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Canonical origin, used for canonical links, absolute Open Graph URLs
  // (link previews in WhatsApp, Instagram, email), the sitemap, and
  // robots.txt. Change this when the site moves domains.
  site: 'https://oursabeel.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  image: { layout: 'constrained' },
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
