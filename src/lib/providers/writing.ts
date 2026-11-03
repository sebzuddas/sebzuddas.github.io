import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { site } from '../site';
import { parseRss, type FeedItem } from './rss';

export type WritingEntry = FeedItem;

/** Where writing comes from. Pages only ever use this interface. */
export interface WritingSource {
  list(): Promise<WritingEntry[]>;
}

/** Substack's first post, not an essay. */
const hidden = new Set(['Coming soon']);

/**
 * The last feed read, committed. Substack refuses some build servers, GitHub's among them,
 * so any build that can read the feed refreshes this, and one that cannot falls back to it.
 */
export const SNAPSHOT = 'src/data/substack.json';

let cached: Promise<WritingEntry[]> | undefined;

export function toSnapshot(items: WritingEntry[]): string {
  return `${JSON.stringify(items.map((item) => ({ ...item, date: item.date?.toISOString() })), null, 2)}\n`;
}

export function fromSnapshot(json: string): WritingEntry[] {
  return (JSON.parse(json) as (Omit<WritingEntry, 'date'> & { date?: string })[]).map((item) => ({ ...item, date: item.date ? new Date(item.date) : undefined }));
}

function save(items: WritingEntry[]) {
  const json = toSnapshot(items);
  // Unchanged files are left alone, so the dev server does not reload itself.
  if (existsSync(SNAPSHOT) && readFileSync(SNAPSHOT, 'utf8') === json) return;
  mkdirSync('src/data', { recursive: true });
  writeFileSync(SNAPSHOT, json);
}

/** Read at build time, so a daily rebuild keeps it fresh. A failed fetch must not fail the build. */
async function fetchFeed(): Promise<WritingEntry[]> {
  try {
    const response = await fetch(site.feed, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'sebzuddas.com build' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parseRss(await response.text()).filter((item) => !hidden.has(item.title));
    if (items.length) save(items);
    return items;
  } catch (error) {
    const fallback = existsSync(SNAPSHOT) ? fromSnapshot(readFileSync(SNAPSHOT, 'utf8')) : [];
    const message = `Could not read ${site.feed} (${error}), so writing uses the saved copy of ${fallback.length} posts in ${SNAPSHOT}.`;
    // In GitHub Actions this line becomes a warning on the run summary.
    console.warn(process.env.GITHUB_ACTIONS ? `::warning::${message}` : message);
    return fallback;
  }
}

export const writing: WritingSource = {
  list: () => (cached ??= fetchFeed()),
};
