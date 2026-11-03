import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromSnapshot, SNAPSHOT, toSnapshot, writing } from './writing';

describe('writing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips the snapshot, dates included', () => {
    const items = [{ title: 'A', url: 'https://x.test/a', description: 'About', date: new Date('2026-06-01T09:01:00Z') }, { title: 'B', url: 'https://x.test/b' }];
    expect(fromSnapshot(toSnapshot(items))).toEqual(items);
  });

  it('falls back to the committed snapshot when the feed cannot be read', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 403 })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const saved = fromSnapshot(readFileSync(SNAPSHOT, 'utf8'));
    expect(saved.length).toBeGreaterThan(0);
    expect(await writing.list()).toEqual(saved);
  });
});
