// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import cloudflare from '@astrojs/cloudflare';

// @astrojs/sitemap emits a sitemap-index.xml that only POINTS to sitemap-0.xml.
// This copies the generated sitemap-0.xml (the actual <urlset> of every page)
// to /sitemap.xml so opening it shows the URLs directly — still auto-fresh,
// never hand-maintained. Runs after sitemap() in build:done. (Cloudflare puts
// static output under dist/client, hence the second candidate path.)
function flatSitemap() {
  return {
    name: 'flat-sitemap',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        const src = [
          join(root, 'sitemap-0.xml'),
          join(root, 'client', 'sitemap-0.xml'),
        ].find(existsSync);
        if (!src) {
          console.warn('[flat-sitemap] sitemap-0.xml not found; skipping');
          return;
        }
        const dest = src.replace(/sitemap-0\.xml$/, 'sitemap.xml');
        copyFileSync(src, dest);
        console.log(`[flat-sitemap] ${src} -> ${dest}`);
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://bureauintake.nl',
  trailingSlash: 'always',

  build: {
    inlineStylesheets: 'always',
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap(), flatSitemap()],
  // Static brochure site — no Astro sessions, no runtime image optimization
  // (images are plain <img>/<picture>, not astro:assets). A bare cloudflare()
  // adapter auto-adds a SESSION KV binding (with no id) + an IMAGES binding,
  // which make the Cloudflare Worker deploy FAIL (the account has neither
  // resource). imageService:'passthrough' drops IMAGES; giving sessions an
  // explicit non-KV driver (unused here) stops the adapter injecting the
  // SESSION KV binding. Deploy then needs no account-specific resources.
  session: { driver: 'memory' },
  adapter: cloudflare({ imageService: 'passthrough' }),
});