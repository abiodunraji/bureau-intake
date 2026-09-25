// Helpers for tests that read the BUILT site (dist/client), i.e. exactly what
// Cloudflare serves and what a crawler or an AI assistant reads. Run
// `npm run build` first (`npm test` does it for you).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = join(ROOT, 'dist', 'client');
export const SITE = 'https://bureauintake.nl';

export function source(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

export function pageFile(urlPath) {
  return join(DIST, ...urlPath.split('/').filter(Boolean), 'index.html');
}

export function pageExists(urlPath) {
  return existsSync(pageFile(urlPath));
}

export function page(urlPath) {
  const file = pageFile(urlPath);
  if (!existsSync(file)) {
    throw new Error(`No built page for ${urlPath} (expected ${file}). Did the build run?`);
  }
  return readFileSync(file, 'utf8');
}

/** Every built HTML page, as [urlPath, html]. */
export function allPages() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, `${prefix}${name}/`);
      else if (name === 'index.html') out.push([prefix, readFileSync(full, 'utf8')]);
    }
  };
  walk(DIST, '/');
  return out;
}

const SHY = String.fromCharCode(0xad);

export function decode(s) {
  return s
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&shy;/g, SHY)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&euro;/g, '€')
    .replace(/&amp;/g, '&');
}

/** Text a reader sees: no scripts/styles/tags, entities decoded, soft hyphens removed. */
export function visibleText(html) {
  return normalize(
    decode(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' '),
    ),
  );
}

export function normalize(s) {
  return s.split(SHY).join('').replace(/\s+/g, ' ').trim();
}

/** All JSON-LD nodes on a page, @graph flattened. */
export function jsonLdNodes(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const data = JSON.parse(m[1]);
    for (const item of [].concat(data)) {
      if (item['@graph']) nodes.push(...item['@graph']);
      else nodes.push(item);
    }
  }
  return nodes;
}

/** Inner text of every element carrying `className`, in document order. */
export function textsByClass(html, className) {
  const re = new RegExp(
    `<(\\w+)\\b[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`,
    'g',
  );
  return [...html.matchAll(re)].map((m) => visibleText(m[2]));
}

export function title(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/);
  return m ? normalize(decode(m[1])) : null;
}

export function metaDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  return m ? normalize(decode(m[1])) : null;
}

export function canonical(html) {
  const m = html.match(/<link rel="canonical" href="([^"]*)"/);
  return m ? m[1] : null;
}

export function hasLinkTo(html, urlPath) {
  const bare = urlPath.replace(/\/$/, '');
  const re = new RegExp(`<a\\b[^>]*\\bhref="(?:${SITE})?${escapeRe(bare)}/?"`);
  return re.test(html);
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Euro amounts in a text, as numbers. Reads "€1.000", "€ 6.000", "€0,30",
 * "€63,50" and "250 euro" the Dutch way ("." = thousands, "," = decimals).
 */
export function euroAmounts(text) {
  const out = [];
  const num = (s) => Number(s.replace(/\./g, '').replace(',', '.'));
  for (const m of text.matchAll(/€\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/g)) {
    out.push(num(m[1] + (m[2] ? `,${m[2]}` : '')));
  }
  for (const m of text.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(?:,-)?\s?euro\b/gi)) {
    out.push(num(m[1] + (m[2] ? `,${m[2]}` : '')));
  }
  return out;
}

/**
 * The price card on the homepage, read from its SOURCE (src/components/Pricing.astro),
 * so no test hardcodes the price or the terms a second time.
 */
export function pricingCard() {
  const src = source('src/components/Pricing.astro');
  const price = src.match(/€(\d+)<span[^>]*>\s*\/(\w+)\s*<\/span>/);
  if (!price) throw new Error('Could not find the €…/maand price in Pricing.astro');
  const terms = src.match(/\/\w+\s*<\/span>\s*<\/div>\s*<p[^>]*>\s*([^<]+?)\s*<\/p>/);
  if (!terms) throw new Error('Could not find the terms line under the price in Pricing.astro');
  const includesBlock = src.match(/const includes = \[([\s\S]*?)\];/);
  if (!includesBlock) throw new Error('Could not find the includes list in Pricing.astro');
  return {
    amount: Number(price[1]),
    unit: price[2],
    priceText: `€${price[1]}`,
    // &nbsp; in the source keeps each term whole on a phone; read it as a plain space.
    terms: normalize(decode(terms[1])).split('·').map((t) => t.trim()).filter(Boolean),
    includes: [...includesBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
  };
}
