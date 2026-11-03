export interface ReadmeStats {
  sections: number;
  figures: number;
  equations: number;
  diagrams: number;
}

const IMAGE = String.raw`(?:<a[^>]*>\s*)?<img[^>]*>(?:\s*<\/a>)?`;
const IMAGES = new RegExp(IMAGE, 'g');
const VIDEO = String.raw`<details[^>]*>(?:(?!<\/details>)[\s\S])*?<video[\s\S]*?<\/details>`;
/** Video blocks, paragraphs that end in images, and images alone on a line. */
const MEDIA = new RegExp(`${VIDEO}|<p[^>]*>(?:(?!</p>|<img)[\\s\\S])*?(?:${IMAGE}\\s*)+</p>|^[ \\t]*${IMAGE}[ \\t]*$`, 'gm');
const HEADING = /<div class="markdown-heading"[^>]*><h([1-6])[^>]*>([\s\S]*?)<\/h\1>(<a id="[^"]*"><\/a>)?\s*<\/div>/g;
const EMOJI = /^(?:\s|<g-emoji[^>]*>[\s\S]*?<\/g-emoji>|\p{Extended_Pictographic}|️|‍)+/u;

/** Badges and sponsor walls are not figures. */
const BADGE = /shields\.io|\/badge|sponsorkit/i;
/** GitHub signs these links for five minutes, so they are dead soon after a build. */
const SIGNED = /private-user-images\.githubusercontent\.com/;

const tag = (text: string) => `<span class="exhibit-tag">${text}</span>`;
const attr = (html: string, name: string) => html.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

function caption(alt?: string): string {
  return alt && !/^(image|img|screenshot|untitled)\b/i.test(alt) ? ` ${alt}` : '';
}

/** Rewrites frames and plates, and counts each kind so numbering follows the page. */
function exhibit(html: string, repo: string, stats: ReadmeStats): string {
  const figure = (body: string, alt?: string) =>
    `<figure class="fig">${body}<figcaption>${tag(`Fig. ${++stats.figures}`)}${caption(alt)}</figcaption></figure>`;
  const away = (kind: string) => `<a class="fig-away" href="${repo}#readme">${kind} on GitHub</a>`;
  return html
    .replace(MEDIA, (block) => {
      if (block.startsWith('<details')) {
        const video = block.match(/<video[^>]*>/)![0];
        const name = block.match(/<span class="m-1">([^<]*)<\/span>/)?.[1];
        if (SIGNED.test(video)) return figure(away('Video'), name);
        return figure(`<video src="${attr(video, 'src')}" controls preload="none"></video>`, name);
      }
      const images = block.match(IMAGES)!;
      if (images.some((image) => BADGE.test(image))) return block;
      const lead = block.slice(0, block.indexOf(images[0])).trim();
      const text = !lead || /^<p[^>]*>$/.test(lead) ? '' : `${lead}</p>`;
      return text + images.map((image) => figure(SIGNED.test(image) ? away('Image') : image, attr(image, 'alt'))).join('');
    })
    .replace(/<span class="equation">/g, () => `<span class="equation">${tag(`Eq. ${++stats.equations}`)}`)
    .replace(/<pre class="mermaid">[\s\S]*?<\/pre>/g, (block) => `<figure class="plate-fig">${tag(`Diagram ${++stats.diagrams}`)}${block}</figure>`)
    .replace(/<div class="highlight highlight-(?:source|text)-([\w+#]+)[^>]*>/g, (open, language) => `${open}${tag(language)}`);
}

function subheadings(html: string, top: number): string {
  return html.replace(HEADING, (_, level, text, anchor = '') => {
    const shifted = Math.min(Number(level) - top + 2, 6);
    return `${anchor}<h${shifted}>${text.replace(EMOJI, '') || text}</h${shifted}>`;
  });
}

/**
 * The formatter behind every project page: one fixed rule per element, so the
 * same README always gives the same poster. Sections split at the highest
 * heading left after the title, and at any heading before it. Text above the
 * first heading becomes an Overview section, and only the first starts open.
 */
export function formatReadme(html: string, repo: string): { html: string; stats: ReadmeStats } {
  const stats: ReadmeStats = { sections: 0, figures: 0, equations: 0, diagrams: 0 };
  const body = exhibit(html, repo, stats).trim();
  if (!body) return { html: '', stats };
  const headings = [...body.matchAll(HEADING)];
  const top = Math.min(...headings.map((m) => Number(m[1])));
  const first = headings.find((m) => Number(m[1]) === top);
  const splits = headings.filter((m) => Number(m[1]) === top || m.index < first!.index);
  const lede = body.slice(0, splits[0]?.index).trim();

  const parts = [
    ...(lede ? [{ title: 'Overview', anchor: '', content: lede }] : []),
    ...splits.map((m, i) => ({
      title: m[2].replace(EMOJI, '') || m[2],
      anchor: m[3] ?? '',
      content: body.slice(m.index + m[0].length, splits[i + 1]?.index).trim(),
    })),
  ];
  stats.sections = parts.length;
  const sections = parts.map(({ title, anchor, content }, i) => {
    const number = String(i + 1).padStart(2, '0');
    return `<details class="exhibit"${i ? '' : ' open'}><summary>${anchor}<span class="n">${number}</span><h2>${title}</h2><i></i></summary><div class="exhibit-body">${subheadings(content, top)}</div></details>`;
  });
  return { html: sections.join(''), stats };
}

/** Runs site-written notes, which have plain headings, through the same rules as a README. */
export function formatNotes(html: string): string {
  const headings = html.replace(/<h([1-6]) id="([^"]*)">([\s\S]*?)<\/h\1>/g, '<div class="markdown-heading"><h$1>$3</h$1><a id="$2"></a></div>');
  return formatReadme(headings, '').html;
}

/** A size step for poster titles, from their length alone, so long ones fit beside the plate. */
export function titleClass(title: string): string | undefined {
  const longest = Math.max(...title.split(/\s+/).map((word) => word.length));
  if (title.length > 44 || longest > 15) return 'longest';
  if (title.length > 24 || longest > 10) return 'long';
  return undefined;
}

/** Each project's rays start somewhere of their own, and never move between builds. */
export function sunburst(name: string): { x: number; y: number; step: number } {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return { x: 62 + (hash % 36), y: 100 + ((hash >>> 8) % 14), step: 6 + ((hash >>> 16) % 5) };
}
