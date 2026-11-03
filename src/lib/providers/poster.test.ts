import { describe, expect, it } from 'vitest';
import { formatNotes, formatReadme, sunburst, titleClass } from './poster';

const repo = 'https://github.com/sebzuddas/demo';
const heading = (level: number, text: string, id = 'x') => `<div class="markdown-heading" dir="auto"><h${level} class="heading-element" dir="auto">${text}</h${level}><a id="user-content-${id}"></a></div>`;
const format = (html: string) => formatReadme(html, repo);

describe('formatReadme sections', () => {
  it('splits at the highest heading and opens only the first', () => {
    const { html, stats } = format(`<p>intro</p>${heading(2, 'One')}<p>a</p>${heading(3, 'Sub')}<p>b</p>${heading(2, 'Two')}<p>c</p>`);
    expect(stats.sections).toBe(3);
    expect(html.match(/<details/g)).toHaveLength(3);
    expect(html.match(/ open>/g)).toHaveLength(1);
    expect(html).toContain('<span class="n">01</span><h2>Overview</h2><i></i></summary><div class="exhibit-body"><p>intro</p></div>');
    expect(html).toContain('<span class="n">03</span><h2>Two</h2>');
    expect(html).toContain('<a id="user-content-x"></a><h3>Sub</h3>');
  });
  it('treats several h1 as the sections, and shifts what sits under them', () => {
    const { html, stats } = format(`${heading(1, 'A')}${heading(2, 'B')}${heading(1, 'C')}`);
    expect(stats.sections).toBe(2);
    expect(html).toContain('<h3>B</h3>');
  });
  it('folds smaller headings that come before the first main one', () => {
    const { html, stats } = format(`<p>intro</p>${heading(3, 'Early')}<p>a</p>${heading(2, 'Main')}<p>b</p>`);
    expect(stats.sections).toBe(3);
    expect(html).toContain('<span class="n">02</span><h2>Early</h2>');
  });
  it('makes a README with no headings one open Overview', () => {
    const { html, stats } = format('<p>A more general way to search</p>');
    expect(stats.sections).toBe(1);
    expect(html).toContain('<details class="exhibit" open>');
    expect(html).toContain('<h2>Overview</h2>');
  });
  it('gives nothing for an empty README', () => expect(format('').html).toBe(''));
  it('drops leading emoji but keeps an emoji-only heading', () => {
    expect(format(heading(2, '🚀 Purpose')).html).toContain('<h2>Purpose</h2>');
    expect(format(heading(2, '🛠️ Stack')).html).toContain('<h2>Stack</h2>');
    expect(format(heading(2, '🚀')).html).toContain('<h2>🚀</h2>');
  });
  it('gives the same output every time', () => {
    const input = `${heading(2, 'One')}<p><img src="a.png" alt="plot"></p>`;
    expect(format(input)).toEqual(format(input));
  });
});

describe('formatReadme exhibits', () => {
  it('frames images in order with their alt text', () => {
    const { html, stats } = format('<p dir="auto"><a href="a.png"><img src="a.png" alt="Step plot"></a></p><p><img src="b.png" alt="screenshot-2021"></p>');
    expect(stats.figures).toBe(2);
    expect(html).toContain('Fig. 1</span> Step plot</figcaption>');
    expect(html).toContain('Fig. 2</span></figcaption>');
    expect(html).not.toContain('<p');
  });
  it('leaves badges and text with inline images alone', () => {
    const badges = '<p><a href="x"><img src="https://img.shields.io/badge/a-b" alt="a"></a></p>';
    expect(format(badges).stats.figures).toBe(0);
    expect(format(badges).html).toContain(badges);
    expect(format('<p>see <img src="a.png" alt="a"> here</p>').stats.figures).toBe(0);
  });
  it('frames an image that ends a paragraph, keeping the text', () => {
    const { html, stats } = format('<p dir="auto">The diagram\n<a href="a.png"><img src="a.png" alt="class diagram"></a></p>');
    expect(stats.figures).toBe(1);
    expect(html).toContain('<p dir="auto">The diagram</p><figure');
  });
  it('frames an image alone on a line, outside any paragraph', () => {
    const { html, stats } = format('<p>a</p>\n<a href="a.png"><img src="a.png" alt="plot"></a>\n<p>b</p>');
    expect(stats.figures).toBe(1);
    expect(html).toContain('<p>a</p>\n<figure');
  });
  it('sends signed media to GitHub, because the links expire', () => {
    const signed = 'https://private-user-images.githubusercontent.com/1/a.mp4?jwt=x';
    const video = `<details open="" class="details-reset"><summary><span class="m-1">run.mp4</span></summary><video src="${signed}" controls="controls"></video></details>`;
    const out = format(video + `<p><img src="${signed}" alt="shot"></p>`);
    expect(out.stats.figures).toBe(2);
    expect(out.html).not.toContain('jwt');
    expect(out.html).toContain(`Fig. 1</span> run.mp4`);
    expect(out.html).toContain(`href="${repo}#readme">Video on GitHub`);
    expect(out.html).toContain('Image on GitHub');
  });
  it('frames lasting video, numbered with the images around it', () => {
    const out = format('<p><img src="a.png" alt="a"></p><details><summary><span class="m-1">v.mp4</span></summary><video src="https://x.test/v.mp4"></video></details><p><img src="b.png" alt="b"></p>');
    expect(out.html).toContain('<video src="https://x.test/v.mp4" controls preload="none"></video><figcaption><span class="exhibit-tag">Fig. 2');
    expect(out.html).toContain('Fig. 3</span> b');
  });
  it('leaves other details alone', () => {
    const notes = '<details><summary>More</summary><p>text</p></details>';
    expect(format(notes).html).toContain(notes);
    expect(format(`${notes}<details><summary><span class="m-1">v</span></summary><video src="https://x.test/v.mp4"></video></details>`).html).toContain(notes);
  });
  it('numbers equations and diagrams, and tags code', () => {
    const { html, stats } = format('<span class="equation">a</span><span class="equation">b</span><pre class="mermaid">flowchart</pre><div class="highlight highlight-source-python notranslate"><pre>x</pre></div>');
    expect(stats).toMatchObject({ equations: 2, diagrams: 1 });
    expect(html).toContain('Eq. 2');
    expect(html).toContain('<figure class="plate-fig"><span class="exhibit-tag">Diagram 1</span><pre class="mermaid">');
    expect(html).toContain('notranslate"><span class="exhibit-tag">python</span><pre>');
  });
});

describe('formatNotes', () => {
  it('folds plain headings like a README', () => {
    const html = formatNotes('<h2 id="what">What</h2><p>a</p><h2>References</h2><ul><li>b</li></ul>');
    expect(html).toContain('<a id="what"></a><span class="n">01</span><h2>What</h2>');
  });
});

describe('titleClass', () => {
  it('steps down by whole length and longest word', () => {
    expect(titleClass('Grid control')).toBeUndefined();
    expect(titleClass('House Optimisation')).toBe('long');
    expect(titleClass('Complex System Modelling of Alcohol-related Health Inequalities')).toBe('longest');
  });
});

describe('sunburst', () => {
  it('is fixed for a name and differs between names', () => {
    expect(sunburst('grid_mpc')).toEqual(sunburst('grid_mpc'));
    expect(sunburst('grid_mpc')).not.toEqual(sunburst('hitl'));
  });
});
