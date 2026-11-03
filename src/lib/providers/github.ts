import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import katex from 'katex';
import config from '../../content/projects/projects.json';
import { formatReadme, type ReadmeStats } from './poster';

const OWNER = 'sebzuddas';
const DOMAIN = 'sebzuddas.com';
const API = 'https://api.github.com';
const CACHE = '.cache/github.json';
const CACHE_HOURS = 1;

export interface Repo {
  name: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  fork: boolean;
  archived: boolean;
  has_pages: boolean;
  pushed_at: string;
}

export interface Project {
  id: string;
  title: string;
  summary?: string;
  method?: string;
  href?: string;
  order: number;
  /** Place among the home page's hand-picked projects. */
  pin?: number;
  repo?: string;
  readme?: string;
  stats?: ReadmeStats;
  site?: string;
  embed: boolean;
  pushed?: string;
}

/** Where a repo's site should be, on the custom domain and over HTTPS. Pages sites have no homepage field. */
export function siteUrl(repo: Pick<Repo, 'name' | 'homepage' | 'has_pages'>): string | undefined {
  if (repo.homepage?.trim()) {
    const url = new URL(repo.homepage.trim());
    url.protocol = 'https:';
    if (url.hostname === `${OWNER}.github.io`) url.hostname = DOMAIN;
    return url.href;
  }
  return repo.has_pages ? `https://${DOMAIN}/${repo.name}/` : undefined;
}

/**
 * Repos whose site lives under a path on this domain with no rewrite to GitHub Pages
 * in vercel.json. Without one, that path is a 404 on the live site.
 */
export function unproxied(repos: Pick<Repo, 'name' | 'homepage' | 'has_pages'>[], sources: string[]): string[] {
  return repos.flatMap((repo) => {
    const site = siteUrl(repo);
    if (!site) return [];
    const url = new URL(site);
    const first = url.pathname.split('/')[1];
    if (url.hostname !== DOMAIN || !first) return [];
    return sources.includes(`/${first}/:path*`) ? [] : [repo.name];
  });
}

/**
 * Where to check a site at build time. Sites under a path on this domain are GitHub Pages
 * behind a rewrite, so they are read at the source: a build must not depend on the
 * deploy it is replacing.
 */
export function pagesUrl(site: string): string {
  const url = new URL(site);
  if (url.hostname === DOMAIN && url.pathname !== '/') url.hostname = `${OWNER}.github.io`;
  return url.href;
}

/** Whether a response's headers allow this domain to put the page in a frame. */
export function allowsEmbedding(headers: Headers): boolean {
  if (headers.get('x-frame-options')) return false;
  const ancestors = headers.get('content-security-policy')?.match(/frame-ancestors([^;]*)/)?.[1].trim();
  return !ancestors || ancestors.split(/\s+/).some((source) => source === '*' || source.includes(DOMAIN));
}

/** Tidies GitHub's rendered README for this site, and points relative links back at the repo. */
export function cleanReadme(html: string, repo: Pick<Repo, 'html_url' | 'default_branch' | 'name'>): string {
  const raw = `https://raw.githubusercontent.com/${OWNER}/${repo.name}/${repo.default_branch}/`;
  const blob = `${repo.html_url}/blob/${repo.default_branch}/`;
  const relative = /^(?![a-z][a-z0-9+.-]*:|#|\/\/)/i;
  return html
    .replace(/^\s*<div id="readme"[^>]*>\s*<article[^>]*>/, '')
    .replace(/<\/article>\s*<\/div>\s*$/, '')
    .replace(/<div class="zeroclipboard-container">[\s\S]*?<\/div>/g, '')
    .replace(/<a id="(user-content-[^"]+)" class="anchor"[^>]*>[\s\S]*?<\/a>/g, '<a id="$1"></a>')
    .replace(/^\s*<div class="markdown-heading"[^>]*><h1[\s\S]*?<\/div>/, '')
    .replace(/href="#(?!user-content-)/g, 'href="#user-content-')
    .replace(/(<img[^>]*\ssrc=")([^"]+)"/g, (_, start, url) => `${start}${relative.test(url) ? raw + url.replace(/^\.?\//, '') : url}"`)
    .replace(/(<a[^>]*\shref=")([^"]+)"/g, (_, start, url) => `${start}${relative.test(url) ? blob + url.replace(/^\.?\//, '') : url}"`)
    .trim();
}

const words = (html: string) => new Set(html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').toLowerCase().match(/[a-z]{3,}/g));

/** Whether a site is only GitHub Pages' copy of the README, current or out of date, which the project page already shows. */
export function mirrorsReadme(siteHtml: string, readmeHtml: string): boolean {
  const readme = words(readmeHtml);
  const site = words(siteHtml);
  const shared = [...readme].filter((word) => site.has(word)).length;
  return shared > 0 && Math.max(shared / readme.size, shared / site.size) > 0.9;
}

const decode = (html: string) => html.replace(/&(lt|gt|quot|#39|amp);/g, (_, name) => ({ lt: '<', gt: '>', quot: '"', '#39': "'", amp: '&' })[name as 'lt']);

function tex(source: string, displayMode: boolean) {
  return katex.renderToString(decode(source).trim(), { displayMode, throwOnError: false, output: 'html' });
}

const equation = (source: string) => `<span class="equation">${tex(source, true)}</span>`;

/** GitHub leaves maths and diagrams as source for its own scripts, so they are compiled here. */
export function compileReadme(html: string): string {
  return html
    .replace(/<section class="js-render-needs-enrichment[\s\S]*?<pre lang="mermaid"[^>]*>([\s\S]*?)<\/pre>[\s\S]*?<\/section>/g, '<pre class="mermaid">$1</pre>')
    .replace(/<section class="js-render-needs-enrichment[\s\S]*?<pre lang="math"[^>]*>([\s\S]*?)<\/pre>[\s\S]*?<\/section>/g, (_, source) => equation(source))
    .replace(/<pre lang="math"[^>]*><code>([\s\S]*?)<\/code><\/pre>/g, (_, source) => equation(source))
    .replace(/<math-renderer[^>]*>\s*\$\$([\s\S]*?)\$\$\s*<\/math-renderer>/g, (_, source) => equation(source))
    .replace(/<math-renderer[^>]*>\s*\$([\s\S]*?)\$\s*<\/math-renderer>/g, (_, source) => tex(source, false));
}

const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** The README's first heading, or the repo name made readable. */
export function titleOf(name: string, html?: string): string {
  const heading = html?.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  const readable = name.replace(/[-_]+/g, ' ');
  const text = heading && plain(heading).replace(/_+/g, ' ').replace(/^[a-z0-9]+(?:-[a-z0-9]+)+$/, (slug) => slug.replace(/-/g, ' '));
  return text || readable[0].toUpperCase() + readable.slice(1);
}

function firstParagraph(html: string): string | undefined {
  const text = html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1];
  const summary = text && plain(text);
  if (!summary || /^todo\b/i.test(summary)) return undefined;
  return summary.length > 160 ? `${summary.slice(0, 157).trimEnd()}...` : summary;
}

async function github(path: string, accept = 'application/vnd.github+json') {
  const token = process.env.GITHUB_TOKEN;
  return fetch(`${API}${path}`, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept, 'user-agent': 'sebzuddas.com build', ...(token && { authorization: `Bearer ${token}` }) },
  });
}

async function readme(repo: Repo): Promise<string | undefined> {
  const response = await github(`/repos/${OWNER}/${repo.name}/readme`, 'application/vnd.github.html+json');
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`README of ${repo.name}: HTTP ${response.status}`);
  return response.text();
}

async function probe(url: string, readmeHtml: string): Promise<Found | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'sebzuddas.com build' } });
    if (!response.ok) return undefined;
    const copy = mirrorsReadme(await response.text(), readmeHtml);
    return { site: response.url, embed: allowsEmbedding(response.headers) && !copy, copy };
  } catch {
    return undefined;
  }
}

/** A site found at build time. A copy is GitHub Pages rendering the README, not a demo. */
interface Found {
  site: string;
  embed: boolean;
  copy?: boolean;
}

interface Fetched {
  repo: Repo;
  rendered?: string;
  found?: Found;
}

async function fetchRepos(): Promise<Fetched[]> {
  const response = await github(`/users/${OWNER}/repos?per_page=100&type=owner&sort=pushed`);
  if (!response.ok) throw new Error(`Repo list: HTTP ${response.status}`);
  const repos = ((await response.json()) as Repo[]).filter((repo) => !repo.fork);
  return Promise.all(repos.map(async (repo) => {
    const rendered = await readme(repo);
    const target = siteUrl(repo);
    const checked = target && pagesUrl(target);
    const found = checked ? await probe(checked, rendered ?? '') : undefined;
    // A site read at GitHub Pages is still linked on this domain.
    return { repo, rendered, found: found && checked !== target ? { ...found, site: target! } : found };
  }));
}

/** Forks and archived repos stay off the site. A deleted repo goes by itself, because it stops being read. */
export function isListed(repo: Pick<Repo, 'name' | 'fork' | 'archived'>): boolean {
  // The repo for this site would list the site on itself.
  return !repo.fork && !repo.archived && repo.name !== `${OWNER}.github.io` && !config.hidden.includes(repo.name);
}

/**
 * Which site a project page links, if any. A copy of the README links nothing, as the page
 * already shows the README. A Pages site with no rewrite on this domain links github.io.
 */
export function linkFor(repo: Pick<Repo, 'name' | 'homepage' | 'has_pages'>, found: Found | undefined, sources: string[]): Found | undefined {
  if (!found || found.copy) return undefined;
  return unproxied([repo], sources).length ? { ...found, site: pagesUrl(found.site) } : found;
}

/** Fixes only the repo's owner can make. In GitHub Actions they show on the run summary. */
function report(listed: Fetched[], sources: string[]) {
  const warn = (message: string) => console.warn(process.env.GITHUB_ACTIONS ? `::warning::${message}` : message);
  const copies = listed.filter(({ found }) => found?.copy).map(({ repo }) => repo.name);
  if (copies.length) warn(`GitHub Pages is serving the README, not a demo, for ${copies.join(', ')}. If the repo has a demo, set Settings > Pages > Source to GitHub Actions.`);
  const missing = unproxied(listed.filter(({ found }) => found && !found.copy).map(({ repo }) => repo), sources);
  if (missing.length) warn(`No rewrite in vercel.json for ${missing.join(', ')}, so they are linked at github.io.`);
}

function toProjects(fetched: Fetched[]): Project[] {
  const sources = (JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: { source: string }[] }).rewrites.map((rule) => rule.source);
  const overrides: Record<string, Partial<Project>> = config.overrides;
  const { pinned } = config;
  const listed = fetched.filter(({ repo }) => isListed(repo)).sort((a, b) => b.repo.pushed_at.localeCompare(a.repo.pushed_at));
  report(listed, sources);
  return listed.map(({ repo, rendered, found }, order): Project => {
    const body = rendered && compileReadme(cleanReadme(rendered, repo));
    const poster = body ? formatReadme(body, repo.html_url) : undefined;
    const id = repo.name.toLowerCase();
    const link = linkFor(repo, found, sources);
    return {
      id,
      title: titleOf(repo.name, rendered),
      summary: repo.description || (body && firstParagraph(body)),
      method: repo.language ?? undefined,
      href: `/projects/${id}/`,
      order,
      pin: pinned.includes(repo.name) ? pinned.indexOf(repo.name) : undefined,
      repo: repo.html_url,
      readme: poster?.html,
      stats: poster?.stats,
      site: link?.site,
      embed: link?.embed ?? false,
      pushed: repo.pushed_at,
      ...overrides[repo.name],
    };
  });
}

/**
 * Read at build time, so a daily rebuild lists new repos. Unlike the writing
 * feed, a failed read fails the build: GitHub's limits would otherwise empty
 * /projects/, and a failed build leaves the last good site live. Local builds
 * reuse a recent result, because anonymous reads are limited to 60 an hour.
 */
export async function projectEntries(): Promise<Project[]> {
  const age = existsSync(CACHE) ? (Date.now() - statSync(CACHE).mtimeMs) / 3_600_000 : Infinity;
  const cached = () => JSON.parse(readFileSync(CACHE, 'utf8')) as Fetched[];
  if (age < CACHE_HOURS) return toProjects(cached());
  try {
    const fetched = await fetchRepos();
    mkdirSync('.cache', { recursive: true });
    writeFileSync(CACHE, JSON.stringify(fetched));
    return toProjects(fetched);
  } catch (error) {
    if (age === Infinity) throw error;
    console.warn(`Using saved projects: ${error}`);
    return toProjects(cached());
  }
}
