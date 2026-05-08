import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '../utils/blog';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({
    title: 'Bureau Intake — Blog',
    description:
      'Inzichten over lokale vindbaarheid, Google Bedrijfsprofiel en online zichtbaarheid voor fysiotherapiepraktijken.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
    customData: '<language>nl-nl</language>',
  });
}
