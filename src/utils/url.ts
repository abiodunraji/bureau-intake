/**
 * Prefix a path with the Astro base URL.
 * Use this for all internal hrefs so paths work both locally and on GitHub Pages.
 *
 * Examples:
 *   url('/')         → '/bureau-intake/'
 *   url('/contact')  → '/bureau-intake/contact'
 *   url('/over')     → '/bureau-intake/over'
 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}
