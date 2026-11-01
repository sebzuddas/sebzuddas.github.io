import { describe, expect, it } from 'vitest';
import { parseRss } from './rss';

const feed = `<rss><channel><title>Blog</title>
<item><title><![CDATA[Fish & chips]]></title><link>https://x.test/a</link><description><![CDATA[About food]]></description><pubDate>Mon, 01 Jun 2026 09:01:00 GMT</pubDate></item>
<item><title>Bread &amp; butter</title><link>https://x.test/b</link></item>
<item><title>No link</title></item>
</channel></rss>`;

describe('parseRss', () => {
  it('reads items, CDATA and entities', () => {
    const items = parseRss(feed);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: 'Fish & chips', url: 'https://x.test/a', description: 'About food' });
    expect(items[0].date?.getUTCFullYear()).toBe(2026);
    expect(items[1].title).toBe('Bread & butter');
  });
  it('returns nothing for an empty or broken feed', () => {
    expect(parseRss('<html>nope</html>')).toEqual([]);
  });
});
