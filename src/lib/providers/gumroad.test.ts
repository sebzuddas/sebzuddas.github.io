import { describe, expect, it } from 'vitest';
import { parseStore, parseSummary, toResources } from './gumroad';

const product = { permalink: 'admfen', name: 'Sixty &amp; five', price_cents: 0, currency_code: 'gbp' };
const store = (sections: unknown) => `<div data-page="${JSON.stringify({ props: { sections } }).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></div>`;

describe('parseStore', () => {
  it('reads products from every section once', () => {
    const results = { search_results: { total: 1, products: [{ ...product, name: 'List' }] } };
    expect(parseStore(store([results, results, { type: 'text' }]))).toEqual([{ ...product, name: 'List' }]);
  });

  it('fails loudly when the page changes shape', () => {
    expect(() => parseStore('<html></html>')).toThrow(/no product data/);
    expect(() => parseStore('<div data-page="{}"></div>')).toThrow(/no sections/);
  });
});

it('reads the description', () => {
  expect(parseSummary('<meta property="og:description" content="Books &amp; papers">')).toBe('Books & papers');
  expect(parseSummary('<title>none</title>')).toBe('');
});

describe('toResources', () => {
  it('links the product and marks it free', () => {
    expect(toResources([{ product, summary: 'A list.' }])[0]).toMatchObject({
      id: 'admfen', category: 'lists',
      delivery: { provider: 'gumroad', url: 'https://sebzuddas.gumroad.com/l/admfen', price: 'free' },
    });
  });

  it('shows the real price of paid products', () => {
    expect(toResources([{ product: { ...product, price_cents: 500 }, summary: '' }])[0].delivery.price).toBe('£5.00');
  });
});
