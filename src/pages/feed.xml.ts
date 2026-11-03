import rss from '@astrojs/rss';
import { writing } from '../lib/providers/writing';
import { site } from '../lib/site';

export async function GET() {
  const posts = await writing.list();
  return rss({
    title: site.name,
    description: site.description,
    site: site.url,
    items: posts.map((p) => ({
      title: p.title,
      description: p.description,
      pubDate: p.date,
      link: p.url,
    })),
  });
}
