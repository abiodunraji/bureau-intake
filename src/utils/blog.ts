import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );
}

export function formatDateNL(d: Date): string {
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Long Dutch compounds ("fysiotherapiepraktijk") are wider than a phone at
// heading size. A soft hyphen (U+00AD) at the seam lets the word break as
// "fysiotherapie-" / "praktijk" on narrow screens and stays invisible
// everywhere else, the same pattern as the /over and /webdesign H1s.
// Display-only: never use it for <title>, JSON-LD or the RSS feed.
const SOFT_HYPHEN = String.fromCharCode(0xad);
export function headingText(title: string): string {
  return title.replace(/fysiotherapie(?=praktijk)/g, `fysiotherapie${SOFT_HYPHEN}`);
}

const WORDS_PER_MINUTE = 220;
export function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
