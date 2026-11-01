import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const choose = async (page: Page, option: string) => {
  await page.locator('.dropdown button').click();
  await page.getByRole('option', { name: option }).click();
};

const routes = ['/', '/resources/tools/', '/resources/tools/cascade/', '/resources/tools/step-response/', '/resources/tools/falcon-9/', '/projects/', '/projects/grid_mpc/', '/resources/', '/writing/', '/about/', '/posts/personal-system-map/'];
const widths = [390, 768, 1440, 2560];
const legacy = fs.readFileSync('tests/legacy-urls.txt', 'utf8').trim().split('\n');

const read = (page: Page, key: string) => page.locator(`[data-readout="${key}"]`).first().innerText();

test('every URL in the old sitemap still resolves', async ({ request }) => {
  for (const url of legacy) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
  }
});

test('no horizontal scroll at any width', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(over, `${route} at ${width}`).toBeLessThanOrEqual(0);
    }
  }
});

test('no element overflows the viewport at 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(route);
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('main *, header *, footer *')]
        .filter((e) => !e.closest('table, pre, .katex-display') && e.getBoundingClientRect().right > innerWidth + 1)
        .map((e) => e.tagName + '.' + e.className).slice(0, 5));
    expect(bad, route).toEqual([]);
  }
});

test('generated content is only ever empty', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const stray = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('*')) {
        for (const pseudo of ['::before', '::after']) {
          const c = getComputedStyle(el, pseudo).content;
          if (c !== 'none' && c !== 'normal' && c !== '""') out.push(`${el.tagName}${pseudo} ${c}`);
        }
      }
      return out;
    });
    expect(stray, route).toEqual([]);
  }
});

test('opening the loop puts the lamp out and zeroes the output', async ({ page }) => {
  await page.goto('/resources/tools/cascade/');
  const lamp = page.locator('[data-lamp]');
  await expect(lamp).toHaveClass(/on/);
  await page.locator('[data-param="l"]').uncheck();
  await expect(lamp).not.toHaveClass(/on/);
  await expect(page.locator('[data-readout="u"]')).toHaveText('0.00');
});

test('permalink restores state and an identical frame', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const hash = '#a=0.12&l=0&h=0.08&s=transit&x=11';
  const snapshot = async () => {
    await page.goto(`/resources/tools/cascade/${hash}`);
    await page.reload();
    await expect(page.locator('[data-readout="A"]')).not.toHaveText('--');
    await page.waitForTimeout(200);
    return page.evaluate(() => ({
      screen: document.querySelector<HTMLCanvasElement>('[data-screen]')!.toDataURL(),
      strip: document.querySelector<HTMLCanvasElement>('[data-recorder]')!.toDataURL(),
      a: (document.querySelector('[data-param="a"]') as HTMLInputElement).value,
      s: (document.querySelector('[data-param="s"]') as HTMLSelectElement).value,
      l: (document.querySelector('[data-param="l"]') as HTMLInputElement).checked,
    }));
  };
  const first = await snapshot();
  const second = await snapshot();
  expect(first).toEqual(second);
  expect(first.a).toBe('0.12');
  expect(first.s).toBe('transit');
  expect(first.l).toBe(false);
  await context.close();
});

test('controls write the permalink', async ({ page }) => {
  await page.goto('/resources/tools/step-response/');
  await page.locator('[data-param="z"]').fill('1');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('z=1.00');
  await expect(page.locator('[data-readout="os"]')).toHaveText('0.0');
  await expect(page.locator('[data-readout="tp"]')).toHaveText('none');
});

test('reduced motion draws a static frame with real readouts', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/resources/tools/cascade/');
  await expect(page.locator('[data-readout="n"]')).toContainText('/160');
  const a = await read(page, 't');
  await page.waitForTimeout(600);
  expect(await read(page, 't')).toBe(a);
  expect(a).toBe('50.0');
  await context.close();
});

test('hero shows a static frame under reduced motion until asked to fly', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-readout="alt"]')).not.toHaveText('--');
  const a = await read(page, 'alt');
  await page.waitForTimeout(600);
  expect(await read(page, 'alt')).toBe(a);
  await context.close();
});

test('the autopilot lands the ship in the browser', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.locator('.panel [data-lamp]')).toHaveClass(/on/);
  await expect(page.locator('[data-readout="st"]')).toHaveText('Landed', { timeout: 45_000 });
});

test('manual mode crashes if nobody flies, and the lamp stays out', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/resources/tools/falcon-9/#m=manual&x=7');
  await page.locator('[data-action="fly"]').click();
  await expect(page.locator('[data-lamp]')).not.toHaveClass(/on/);
  await expect(page.locator('[data-readout="st"]')).toHaveText('Hard landing', { timeout: 45_000 });
});

test('keycaps sit in the shape of the keyboard and follow the mode', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/resources/tools/falcon-9/');
  const box = (slot: string) => page.locator(`[data-pad="arrows"] .key.${slot}`).boundingBox();
  const [up, left, down, right] = await Promise.all(['up', 'left', 'down', 'right'].map(box));
  expect(up!.y).toBeLessThan(down!.y);
  expect(Math.abs(up!.x - down!.x)).toBeLessThan(2);
  expect(left!.x).toBeLessThan(down!.x);
  expect(right!.x).toBeGreaterThan(down!.x);
  expect(Math.abs(left!.y - down!.y)).toBeLessThan(2);
  await choose(page, 'Assisted');
  await expect(page.locator('[data-pad="arrows"] .key.up')).toContainText('Go away');
  await expect(page.locator('[data-pad="arrows"] .key.up')).toHaveAttribute('aria-label', '↑: Go away');
  await expect(page.locator('[data-pad="wasd"] .key.up')).toContainText('Descend slower');
  await page.keyboard.down('ArrowLeft');
  await expect(page.locator('[data-pad="arrows"] .key.left')).toHaveClass(/pressed/);
  await page.keyboard.up('ArrowLeft');
  await expect(page.locator('[data-pad="arrows"] .key.left')).not.toHaveClass(/pressed/);
});

test('flies in 3D only, with two key clusters', async ({ page }) => {
  await page.goto('/resources/tools/falcon-9/');
  await expect(page.locator('[data-param="d"]')).toHaveCount(0);
  await expect(page.locator('[data-pad="wasd"]')).toBeVisible();
  await expect(page.locator('[data-pad="arrows"] .key.up')).toContainText('Autopilot');
  await expect(page.locator('[data-readout="vy"]')).toBeVisible();
  await choose(page, 'Manual');
  await expect(page.locator('[data-pad="arrows"] .key.up')).toContainText('Steer away');
  await expect(page.locator('[data-pad="wasd"] .key.up')).toContainText('Throttle up');
});

test('autopilot status is a styled dropdown that works from the keyboard', async ({ page }) => {
  await page.goto('/resources/tools/falcon-9/');
  await expect(page.locator('.control').filter({ hasText: 'Autopilot status' })).toBeVisible();
  const trigger = page.locator('.dropdown button');
  await expect(trigger).toHaveText('On');
  await expect(page.locator('select[data-param="m"]')).toBeHidden();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option')).toHaveText(['On', 'Assisted', 'Manual']);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveText('Manual');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(page.locator('[data-lamp]')).not.toHaveClass(/on/);
  await expect(page).toHaveURL(/m=manual/);
});

test('the legs come out near the ground', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/resources/tools/falcon-9/');
  await expect(page.locator('[data-readout="st"]')).toHaveText('Descending');
  await expect(page.locator('[data-readout="st"]')).toHaveText('Legs deploying', { timeout: 45_000 });
  expect(Number(await page.locator('[data-readout="alt"]').textContent())).toBeLessThan(85);
});

test('projects come from GitHub, embedding a site or linking to it', async ({ page }) => {
  await page.goto('/projects/');
  await expect(page.locator('main')).toContainText('Grid control');
  await expect(page.locator('main a[href="/projects/overknight/"]')).toHaveCount(1);
  await expect(page.locator('main a[href="/projects/.claude/"]')).toHaveCount(0);
  await expect(page.locator('main a[href="/projects/housingprofile/"]')).toHaveCount(0);
  await page.goto('/projects/predator-prey/');
  await expect(page.locator('.project-embed iframe')).toHaveAttribute('src', 'https://sebzuddas.com/predator-prey/');
  await expect(page.locator('.readme')).not.toBeEmpty();
  await page.goto('/projects/grid_mpc/');
  await expect(page.locator('.project-embed iframe')).toHaveCount(0);
  await expect(page.locator('.project-links a').first()).toHaveAttribute('href', 'https://sebzuddas.com/grid_mpc/');
  await page.goto('/projects/hitl/');
  await expect(page.locator('.project-embed iframe')).toHaveCount(0);
  await expect(page.locator('.project-links a').first()).toHaveAttribute('href', 'https://sebzuddas.com/HITL/');
  await page.goto('/projects/exercism/');
  await expect(page.locator('.project-embed iframe')).toHaveCount(0);
  await expect(page.locator('.project-links a').first()).toHaveAttribute('href', /exercism\.org/);
  await page.goto('/projects/overknight/');
  await expect(page.locator('.project-links a')).toHaveCount(1);
  await expect(page.locator('.project-links a')).toHaveAttribute('href', 'https://github.com/sebzuddas/overknight');
});

test('README maths and diagrams are compiled in the page', async ({ page }) => {
  await page.goto('/projects/grid_mpc/');
  await expect(page.locator('.readme .katex').first()).toBeVisible();
  await expect(page.locator('.readme math-renderer')).toHaveCount(0);
  await expect(page.locator('.readme')).not.toContainText('$$');
  await page.goto('/projects/fct_python/');
  await page.locator('.exhibit:has(.mermaid)').first().evaluate((section: HTMLDetailsElement) => { section.open = true; });
  await expect(page.locator('.readme .mermaid svg').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('.readme .mermaid svg').first()).toBeVisible({ timeout: 15_000 });
});

test('numbers use the seven-segment font', async ({ page }) => {
  await page.goto('/resources/tools/falcon-9/');
  const font = await page.locator('.seg').first().evaluate((e) => getComputedStyle(e).fontFamily);
  expect(font).toContain('DSEG7');
  expect(await page.evaluate(async () => { await document.fonts.load('16px DSEG7'); return document.fonts.check('16px DSEG7'); })).toBe(true);
});

test('writing lists Substack and offers the button', async ({ page, request }) => {
  await page.goto('/writing/');
  await expect(page.locator('main a[href*="substack.com/p/"]').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Coming soon');
  await expect(page.locator('.signup a.btn')).toHaveAttribute('href', 'https://sebzuddas.substack.com');
  const moved = await (await request.get('/posts/5-lessons-from-the-worlds-most-ambitious-rooms/')).text();
  expect(moved).toContain('substack.com/p/5-lessons');
});

test('keys only steer while flying, so the page still scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test('the loop stops when the instrument is offscreen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/');
  await page.locator('[data-screen]').first().scrollIntoViewIfNeeded();
  const t1 = await read(page, 't');
  await page.waitForTimeout(500);
  expect(await read(page, 't')).not.toBe(t1);
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const t2 = await read(page, 't');
  await page.waitForTimeout(800);
  expect(await read(page, 't')).toBe(t2);
});

test('no layout shift, and the largest paint is text', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as any[]) (window as any).__lcp = e.element?.tagName;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(1200);
  const { cls, lcp } = await page.evaluate(() => ({ cls: (window as any).__cls, lcp: (window as any).__lcp }));
  expect(cls).toBeLessThan(0.01);
  expect(lcp).not.toBe('CANVAS');
});

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const theme of ['dark', 'light']) {
  test(`contrast holds in ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await page.goto('/');
    const tokens = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const panel = getComputedStyle(document.querySelector('.panel')!);
      const get = (s: CSSStyleDeclaration, n: string) => s.getPropertyValue(n).trim();
      return {
        ink: get(css, '--ink'), muted: get(css, '--muted'), accent: get(css, '--accent-ink'), bg: get(css, '--bg'),
        surface: get(css, '--surface'), onAccent: get(css, '--on-accent'), accentBg: get(css, '--accent'),
        poster: get(css, '--poster'), posterRay: get(css, '--poster-ray'), posterInk: get(css, '--poster-ink'),
        plate: get(css, '--plate'), plateInk: get(css, '--plate-ink'), plateMuted: get(css, '--plate-muted'),
        panel: get(panel, '--panel-bg'), panelInk: get(panel, '--panel-ink'), panelMuted: get(panel, '--panel-muted'),
      };
    });
    const pairs: [string, string][] = [
      [tokens.ink, tokens.bg], [tokens.muted, tokens.bg], [tokens.accent, tokens.bg], [tokens.ink, tokens.surface],
      [tokens.onAccent, tokens.accentBg], [tokens.plateInk, tokens.plate], [tokens.plateMuted, tokens.plate],
      [tokens.panelInk, tokens.panel], [tokens.panelMuted, tokens.panel],
      [tokens.posterInk, tokens.poster], [tokens.posterInk, tokens.posterRay],
    ];
    for (const [fg, bg] of pairs) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
}

test('every material keeps panel text legible', async ({ page }) => {
  await page.goto('/');
  for (const material of ['phosphor', 'blueprint', 'plotter']) {
    const t = await page.evaluate((m) => {
      const p = document.querySelector<HTMLElement>('.panel')!;
      p.dataset.material = m;
      const s = getComputedStyle(p);
      return { bg: s.getPropertyValue('--panel-bg').trim(), ink: s.getPropertyValue('--panel-ink').trim(), muted: s.getPropertyValue('--panel-muted').trim() };
    }, material);
    expect(contrast(t.ink, t.bg), material).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.muted, t.bg), material).toBeGreaterThanOrEqual(4.5);
  }
});

test('theme toggle persists', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('[data-theme-toggle]').click();
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before);
});

test('no console errors on any route', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && m.location().url.includes('localhost')) errors.push(m.text()); });
  for (const route of routes) await page.goto(route);
  expect(errors).toEqual([]);
});

test('feed and redirects are valid', async ({ request, page }) => {
  const feed = await (await request.get('/feed.xml')).text();
  expect((feed.match(/<item>/g) ?? []).length).toBeGreaterThan(0);
  const moved = await (await request.get('/wiki/')).text();
  expect(moved).toContain('url=https://wiki.sebzuddas.com');
  await page.goto('/tags/ai/');
  await page.waitForURL('**/writing/');
});

test('README sections fold, and links open them', async ({ page }) => {
  await page.goto('/projects/grid_mpc/');
  const sections = page.locator('.exhibit');
  await expect(sections.first()).toHaveAttribute('open', '');
  await expect(sections.nth(1)).not.toHaveAttribute('open', '');
  await sections.nth(1).locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(sections.nth(1)).toHaveAttribute('open', '');
  await expect(page.locator('.fig img').first()).toBeVisible();
  const id = await sections.nth(2).locator('summary a').getAttribute('id');
  await page.goto(`/projects/grid_mpc/#${id}`);
  await expect(sections.nth(2)).toHaveAttribute('open', '');
});

test('a project with no README still gets a poster with its links', async ({ page }) => {
  await page.goto('/projects/optimisation/');
  await expect(page.locator('.claim h1')).toBeVisible();
  await expect(page.locator('.readme')).toHaveCount(0);
  await expect(page.locator('.project-links a.btn')).toHaveCount(1);
});

test('signed GitHub media never reaches the page', async ({ page }) => {
  for (const slug of ['hitl', 'acs233', 'acs6116-rocket-landing-mpc']) {
    await page.goto(`/projects/${slug}/`);
    expect(await page.content()).not.toContain('private-user-images');
  }
});

test('the signup is slim until asked, then unfolds Substack\'s form in place', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const strip = page.locator('.signup');
  await expect(strip.locator('iframe')).toHaveCount(0);
  await expect(strip.locator('a.btn')).toHaveAttribute('href', /substack\.com/);
  expect((await strip.boundingBox())!.height).toBeLessThan(120);
  await strip.locator('a.btn').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(strip.locator('iframe')).toHaveAttribute('src', 'https://sebzuddas.substack.com/embed');
  await expect(strip.locator('a.btn')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await strip.boundingBox())!.height).toBeGreaterThan(350);
});

test('About hangs the poster', async ({ page }) => {
  await page.goto('/about/');
  const poster = page.locator('.print img');
  await expect(poster).toBeVisible();
  expect(await poster.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test('buttons wake on hover, and stay still with reduced motion', async ({ browser }) => {
  for (const [reducedMotion, name] of [['no-preference', 'orbit'], ['reduce', 'none']] as const) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await page.goto('/projects/grid_mpc/');
    await page.locator('.project-links a').first().hover();
    const animation = await page.locator('.project-links a').first().evaluate((a) => getComputedStyle(a, '::before').animationName);
    expect(animation).toBe(name);
    expect(await page.locator('.project-links a .electron').first().evaluate((dot) => getComputedStyle(dot).animationName)).toBe(reducedMotion === "reduce" ? "none" : "electron");
    await context.close();
  }
});

test('the home page keeps its picks while projects run by date', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main a.row[href^="/projects/"]').first()).toHaveAttribute('href', '/projects/acs6116-rocket-landing-mpc/');
  await page.goto('/projects/');
  await expect(page.locator('main ol.rows a.row').first()).not.toHaveAttribute('href', '/projects/acs6116-rocket-landing-mpc/');
});

test('electrons ride their ellipses on hover, on every orbit', async ({ page }) => {
  await page.goto('/projects/grid_mpc/');
  const name = page.locator('.bar .name');
  const read = () => name.evaluate((link) => [...link.querySelectorAll<SVGCircleElement>('.electron')].map((dot) => {
    const box = dot.getBoundingClientRect();
    const local = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform((dot.parentNode as SVGGElement).getScreenCTM()!.inverse());
    return { x: local.x, y: local.y, on: (local.x / 21) ** 2 + (local.y / 8) ** 2 };
  }));
  const before = await read();
  await page.waitForTimeout(200);
  expect(await read()).toEqual(before);
  expect(await name.locator('.electron').first().evaluate((dot) => getComputedStyle(dot).opacity)).toBe('0');
  expect(await name.locator('.nucleus').evaluate((dot) => getComputedStyle(dot).filter)).toContain('drop-shadow');
  await name.hover();
  await page.waitForTimeout(300);
  const after = await read();
  after.forEach((dot, i) => {
    expect(dot.x).not.toBeCloseTo(before[i].x, 1);
    expect(dot.on).toBeGreaterThan(0.9);
    expect(dot.on).toBeLessThan(1.1);
  });
  await expect(name.locator('.electron').first()).toHaveCSS('opacity', '1');
  const orbits = await name.evaluate((link) => [...link.querySelectorAll('.electron')].map((dot) => dot.getAnimations().find((a) => (a as CSSAnimation).animationName === 'electron')!.effect!.getComputedTiming().progress!));
  expect(((orbits[1] - orbits[0] + 1) % 1)).toBeCloseTo(1 / 3, 2);
  expect(((orbits[2] - orbits[1] + 1) % 1)).toBeCloseTo(1 / 3, 2);
  for (let sample = 0; sample < 8; sample++) {
    const dots = await name.locator('.electron').evaluateAll((all) => all.map((dot) => { const box = dot.getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2]; }));
    for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) expect(Math.hypot(dots[a][0] - dots[b][0], dots[a][1] - dots[b][1])).toBeGreaterThan(15);
    await page.waitForTimeout(90);
  }
  await page.mouse.move(600, 600);
  await name.hover();
  const restarted = await name.locator('.electron').first().evaluate((dot) => dot.getAnimations().find((a) => (a as CSSAnimation).animationName === 'electron')!.effect!.getComputedTiming().progress!);
  expect(restarted).toBeLessThan(0.2);
});

test('tool pages use the poster and folding notes in printed type', async ({ page }) => {
  await page.goto('/resources/tools/step-response/');
  await expect(page.locator('.claim h1')).toBeVisible();
  await expect(page.locator('.exhibit')).toHaveCount(2);
  await expect(page.locator('.exhibit').first()).toHaveAttribute('open', '');
  expect(await page.locator('.exhibit-body p').first().evaluate((p) => getComputedStyle(p).fontFamily)).toContain('Libre Caslon Text');
});

test('long titles stay clear of the plate', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const slug of ['house_optimisation', 'fct_python', 'haos_mpc']) {
      await page.goto(`/projects/${slug}/`);
      await expect(page.locator('.claim h1')).toBeVisible();
      const overlap = await page.evaluate(() => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('.claim h1')!);
        const a = range.getBoundingClientRect();
        const b = document.querySelector('.claim .plate')!.getBoundingClientRect();
        return a.right > b.left + 1 && a.left < b.right && a.bottom > b.top + 1 && a.top < b.bottom;
      });
      expect(overlap, `${slug} at ${width}`).toBe(false);
    }
  }
});

test('tools live under resources', async ({ page, request }) => {
  await page.goto('/resources/');
  await expect(page.locator('a.row[href="/resources/tools/falcon-9/"]')).toBeVisible();
  await expect(page.locator('.bar nav a', { hasText: 'Tools' })).toHaveCount(0);
  await page.goto('/resources/tools/falcon-9/');
  await expect(page.locator('.bar nav a[aria-current="page"]')).toHaveText('Resources');
  expect((await request.get('/tools/')).status()).toBe(404);
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain('/resources/tools/falcon-9/');
  expect(sitemap).not.toMatch(/sebzuddas\.com\/tools\//);
});

test('resources list what is live in the Gumroad store', async ({ page }) => {
  for (const route of ['/resources/', '/resources/lists/']) {
    await page.goto(route);
    await expect(page.locator('a.row[href^="https://sebzuddas.gumroad.com/l/"]').first()).toBeVisible();
  }
});
