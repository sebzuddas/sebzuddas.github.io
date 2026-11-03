import { describe, expect, it } from 'vitest';
import { allowsEmbedding, cleanReadme, compileReadme, isListed, mirrorsReadme, siteUrl, titleOf, unproxied } from './github';

const repo = { name: 'demo', html_url: 'https://github.com/sebzuddas/demo', default_branch: 'main' };

describe('siteUrl', () => {
  it('moves github.io and plain http sites to the custom domain over HTTPS', () => {
    expect(siteUrl({ name: 'x', homepage: 'https://sebzuddas.github.io/x/', has_pages: true })).toBe('https://sebzuddas.com/x/');
    expect(siteUrl({ name: 'wiki', homepage: 'http://wiki.sebzuddas.com/', has_pages: true })).toBe('https://wiki.sebzuddas.com/');
  });
  it('finds a Pages site with no homepage set, and reports no site otherwise', () => {
    expect(siteUrl({ name: 'x', homepage: null, has_pages: true })).toBe('https://sebzuddas.com/x/');
    expect(siteUrl({ name: 'x', homepage: '', has_pages: false })).toBeUndefined();
  });
});

describe('unproxied', () => {
  it('names Pages sites on this domain that have no rewrite', () => {
    const repos = [
      { name: 'grid_mpc', homepage: null, has_pages: true },
      { name: 'new_site', homepage: null, has_pages: true },
      { name: 'wiki', homepage: 'http://wiki.sebzuddas.com/', has_pages: true },
      { name: 'plain', homepage: null, has_pages: false },
    ];
    expect(unproxied(repos, ['/grid_mpc/:path*'])).toEqual(['new_site']);
  });
});

describe('allowsEmbedding', () => {
  const headers = (init: Record<string, string>) => new Headers(init);
  it('allows pages with no frame rules', () => expect(allowsEmbedding(headers({}))).toBe(true));
  it('refuses X-Frame-Options', () => expect(allowsEmbedding(headers({ 'x-frame-options': 'SAMEORIGIN' }))).toBe(false));
  it('reads frame-ancestors', () => {
    const policy = (value: string) => headers({ 'content-security-policy': `default-src 'self'; frame-ancestors ${value}` });
    expect(allowsEmbedding(policy("'none'"))).toBe(false);
    expect(allowsEmbedding(policy('https://sebzuddas.com'))).toBe(true);
  });
});

describe('mirrorsReadme', () => {
  const readme = '<p>Model predictive control of a power grid</p>';
  it('spots a Pages copy of the README', () => {
    expect(mirrorsReadme(`<html><title>Repo</title><body>${readme}<footer>Hosted on GitHub Pages</footer></body></html>`, readme)).toBe(true);
  });
  it('keeps a real site', () => {
    expect(mirrorsReadme('<canvas></canvas><p>Control panel</p><script>const model = 1; const predictive = 2;</script>', readme)).toBe(false);
  });
  it('keeps a site when there is no README to compare', () => expect(mirrorsReadme('<p>Anything</p>', '')).toBe(false));
});

describe('cleanReadme', () => {
  const page = (body: string) => `<div id="readme" class="md"><article class="markdown-body">${body}</article></div>`;
  it('drops the wrapper and the title, which the page already shows', () => {
    expect(cleanReadme(page('<div class="markdown-heading"><h1>Demo</h1><a id="user-content-demo" class="anchor" href="#demo"><svg></svg></a></div><p>Hello</p>'), repo)).toBe('<p>Hello</p>');
  });
  it('keeps in-page links working without GitHub scripts', () => {
    const out = cleanReadme(page('<a href="#setup">Setup</a><a id="user-content-setup" class="anchor" href="#setup"><svg></svg></a>'), repo);
    expect(out).toBe('<a href="#user-content-setup">Setup</a><a id="user-content-setup"></a>');
  });
  it('points relative images and links at the repo, and leaves absolute ones', () => {
    const out = cleanReadme(page('<img src="./a/b.png"><img src="https://x.io/c.png"><a href="docs/d.md">d</a>'), repo);
    expect(out).toContain('src="https://raw.githubusercontent.com/sebzuddas/demo/main/a/b.png"');
    expect(out).toContain('src="https://x.io/c.png"');
    expect(out).toContain('href="https://github.com/sebzuddas/demo/blob/main/docs/d.md"');
  });
});

describe('mirrorsReadme, out-of-date copies', () => {
  it('catches a site that holds only an older part of the README', () => {
    const readme = '<p>alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november</p>';
    expect(mirrorsReadme('<p>alpha bravo charlie delta</p>', readme)).toBe(true);
    expect(mirrorsReadme('<p>alpha bravo charlie delta quebec romeo sierra tango</p>', readme)).toBe(false);
  });
});

describe('compileReadme', () => {
  it('typesets inline and display maths, decoding entities first', () => {
    const out = compileReadme('<math-renderer class="js-inline-math">$a &lt; b$</math-renderer> <math-renderer class="js-display-math">$$x^2$$</math-renderer>');
    expect(out).not.toContain('math-renderer');
    expect(out).toContain('class="katex"');
    expect(out).toContain('katex-display');
    expect(out).toContain('&lt;');
  });
  it('keeps bad maths on the page instead of failing the build', () => {
    expect(compileReadme('<math-renderer>$\\nope{$</math-renderer>')).toContain('katex');
  });
  it('turns GitHub diagram blocks into their source', () => {
    const block = '<section class="js-render-needs-enrichment x"><div data-json="{}"></div><div><pre lang="mermaid" aria-label="Raw">flowchart\nA --&gt; B</pre></div></section>';
    expect(compileReadme(`<p>a</p>${block}<p>b</p>`)).toBe('<p>a</p><pre class="mermaid">flowchart\nA --&gt; B</pre><p>b</p>');
  });
});

describe('isListed', () => {
  const repo = { name: 'demo', fork: false, archived: false };
  it('lists an ordinary repo', () => expect(isListed(repo)).toBe(true));
  it('drops archived repos and forks', () => {
    expect(isListed({ ...repo, archived: true })).toBe(false);
    expect(isListed({ ...repo, fork: true })).toBe(false);
  });
  it('drops repos hidden by hand', () => expect(isListed({ ...repo, name: 'housingprofile' })).toBe(false));
});

describe('titleOf', () => {
  it('prefers the README heading', () => expect(titleOf('a_b', '<h1 class="x">Better <em>name</em></h1>')).toBe('Better name'));
  it('reads repo-style headings as words, but keeps real hyphens', () => {
    expect(titleOf('x', '<h1>House_Optimisation</h1>')).toBe('House Optimisation');
    expect(titleOf('x', '<h1>graph-search-tool</h1>')).toBe('graph search tool');
    expect(titleOf('x', '<h1>Predator-Prey Model</h1>')).toBe('Predator-Prey Model');
  });
  it('falls back to a readable repo name', () => expect(titleOf('house_optimisation')).toBe('House optimisation'));
});
