export interface FeedItem {
  title: string;
  url: string;
  description?: string;
  date?: Date;
}

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

function text(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  if (!match) return undefined;
  const cdata = match[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return match[1].replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, name) => entities[name]).trim();
}

export function parseRss(xml: string): FeedItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.flatMap((block) => {
    const title = text(block, 'title');
    const url = text(block, 'link');
    if (!title || !url) return [];
    const published = text(block, 'pubDate');
    return [{ title, url, description: text(block, 'description') || undefined, date: published ? new Date(published) : undefined }];
  });
}
