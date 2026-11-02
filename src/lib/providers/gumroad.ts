import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { site } from '../site';
import type { Category } from '../resources';

const CACHE = '.cache/gumroad.json';
const CACHE_HOURS = 1;
const CATEGORY: Category = 'lists';

export interface StoreProduct {
  permalink: string;
  name: string;
  price_cents: number;
  currency_code: string;
}

export interface Resource {
  id: string;
  title: string;
  summary: string;
  category: Category;
  tier: 'open';
  delivery: { provider: 'gumroad'; url: string; price: string };
}

interface Fetched {
  product: StoreProduct;
  summary: string;
}

const entities: Record<string, string> = { quot: '"', '#39': "'", apos: "'", lt: '<', gt: '>', amp: '&' };
const decode = (text: string) => text.replace(/&(quot|#39|apos|lt|gt|amp);/g, (_, name) => entities[name]);

/** The store page carries its products as JSON. No token is needed, and it holds only what is public. */
export function parseStore(html: string): StoreProduct[] {
  const page = html.match(/data-page="([^"]*)"/)?.[1];
  if (!page) throw new Error('Gumroad store page has no product data');
  const sections: { search_results?: { total: number; products: StoreProduct[] } }[] = JSON.parse(decode(page)).props?.sections;
  if (!Array.isArray(sections)) throw new Error('Gumroad store page has no sections');
  const found = sections.flatMap((section) => section.search_results?.products ?? []);
  const shown = sections.reduce((sum, section) => sum + (section.search_results?.total ?? 0), 0);
  if (shown > found.length) console.warn(`Gumroad lists ${shown} products but the store page held ${found.length}`);
  return [...new Map(found.map((product) => [product.permalink, product])).values()];
}

export function parseSummary(html: string): string {
  return decode(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? '').trim();
}

export function priceOf({ price_cents, currency_code }: StoreProduct): string {
  if (!price_cents) return 'free';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency_code.toUpperCase() }).format(price_cents / 100);
}

export function toResources(fetched: Fetched[]): Resource[] {
  return fetched.map(({ product, summary }) => ({
    id: product.permalink,
    title: product.name,
    summary,
    category: CATEGORY,
    tier: 'open',
    delivery: { provider: 'gumroad', url: `${site.gumroad}/l/${product.permalink}`, price: priceOf(product) },
  }));
}

async function page(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'sebzuddas.com build' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function fetchStore(): Promise<Fetched[]> {
  const products = parseStore(await page(`${site.gumroad}/`));
  return Promise.all(products.map(async (product) => ({ product, summary: parseSummary(await page(`${site.gumroad}/l/${product.permalink}`)) })));
}

/** Rebuilds list what is live in the store. A failed read fails the build, as for projects, so the last good site stays up. */
export async function resourceEntries(): Promise<Resource[]> {
  const age = existsSync(CACHE) ? (Date.now() - statSync(CACHE).mtimeMs) / 3_600_000 : Infinity;
  const cached = () => JSON.parse(readFileSync(CACHE, 'utf8')) as Fetched[];
  if (age < CACHE_HOURS) return toResources(cached());
  try {
    const fetched = await fetchStore();
    mkdirSync('.cache', { recursive: true });
    writeFileSync(CACHE, JSON.stringify(fetched));
    return toResources(fetched);
  } catch (error) {
    if (age === Infinity) throw error;
    console.warn(`Using saved resources: ${error}`);
    return toResources(cached());
  }
}
