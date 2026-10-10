import type { APIRoute } from 'astro';

/** Lets search engines crawl every page and names the sitemap, at the address in `site`. */
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site)}\n`);
