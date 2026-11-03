import { site } from '../site';
import { parseRss, type FeedItem } from './rss';

export type WritingEntry = FeedItem;

/** Where writing comes from. Pages only ever use this interface. */
export interface WritingSource {
  list(): Promise<WritingEntry[]>;
}

/** Substack's first post, not an essay. */
const hidden = new Set(['Coming soon']);

let cached: Promise<WritingEntry[]> | undefined;

/** Read at build time, so a daily rebuild keeps it fresh. A failed fetch must not fail the build. */
async function fetchFeed(): Promise<WritingEntry[]> {
  try {
    const response = await fetch(site.feed, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'sebzuddas.com build' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseRss(await response.text()).filter((item) => !hidden.has(item.title));
  } catch (error) {
    console.warn(`Could not read ${site.feed}: ${error}`);
    return [];
  }
}

export const writing: WritingSource = {
  list: () => (cached ??= fetchFeed()),
};
