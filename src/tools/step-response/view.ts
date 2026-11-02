import { fit, runFrames, type Mount } from '../../lib/instrument/runtime';
import { fromRoots, type Complex } from '../../lib/instrument/signal';
import {
  coefficients, dcGain, discretise, grouped, metrics, parse, poles, regions, simulate, stability, surface, timeSpan, ungrouped, zeros,
  type Discrete, type Trace, type Transfer,
} from './model';

const GRID = 37;
const REPLAY_SECONDS = 3;
/** Height of the surface, as log10 of the magnitude. */
const LIMIT = 1.5;

interface Plane {
  cx: number;
  cy: number;
  /** Pixels per unit. */
  scale: number;
  reach: number;
}
interface Marker {
  x: number;
  y: number;
  kind: 'pole' | 'zero';
  index: number;
}
const fixed = (value: number | undefined, digits = 2) => (value === undefined || !Number.isFinite(value) ? 'none' : value.toFixed(digits));
/** A round step that fits about this many divisions into a range. */
function ticks(range: number, divisions = 6) {
  const rough = range / divisions;
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].find((step) => step * power >= rough)! * power;
}
const compact = (value: number) => (Math.abs(value) >= 1000 || (value !== 0 && Math.abs(value) < 0.01) ? value.toExponential(1) : Number(value.toPrecision(3)).toString());

export const mount: Mount = (ctx) => {
  const { state, screen } = ctx;
  const drawing = screen.getContext('2d');
  if (!drawing) throw new Error('No 2D canvas');
  const g = drawing;

  let system: Transfer | undefined;
  let reason = '';
  let trace: Trace | undefined;
  let digital: Discrete | undefined;
  let cursor = ctx.reduced ? 1 : 0;
  let yaw = -0.7;
  let pitch = 0.75;
  let markers: Marker[] = [];
  let sPlane: Plane | undefined;
  let surfaces: { s?: number[][]; z?: number[][] } = {};
  const unit = () => Math.min(devicePixelRatio || 1, 2);
  const area = () => regions(screen.width, screen.height, unit());
  const text = (px: number) => `${px * unit()}px ${ctx.token('--f-mono')}`;

  const clear = (r: { x: number; y: number; w: number; h: number }) => {
    g.fillStyle = ctx.token('--screen-bg');
    g.fillRect(r.x, r.y, r.w, r.h);
  };

  function drawTime() {
    const r = area().time;
    const u = unit();
    clear(r);
    if (!trace) {
      g.fillStyle = ctx.token('--screen-alert');
      g.font = text(13);
      g.textAlign = 'center';
      g.fillText(reason, r.w / 2, r.h / 2);
      return;
    }
    const { t, y, end } = trace;
    const low = Math.min(0, 1, ...y);
    const high = Math.max(0, 1, ...y);
    const margin = (high - low || 1) * 0.08;
    const bottom = low - margin;
    const top = high + margin;
    const left = 44 * u;
    const px = (time: number) => left + (time / end) * (r.w - left - 12 * u);
    const py = (value: number) => r.h - 22 * u - ((value - bottom) / (top - bottom)) * (r.h - 34 * u);

    g.font = text(11);
    g.lineWidth = u;
    g.strokeStyle = ctx.token('--screen-faint');
    g.fillStyle = ctx.token('--screen-ink');
    const across = ticks(end);
    for (let i = 0; i * across <= end + 1e-9; i++) {
      const time = i * across;
      g.beginPath();
      g.moveTo(px(time), py(bottom));
      g.lineTo(px(time), py(top));
      g.stroke();
      g.textAlign = 'center';
      g.fillText(compact(time), px(time), r.h - 6 * u);
    }
    const upward = ticks(top - bottom, 5);
    for (let i = Math.ceil(bottom / upward); i * upward <= top; i++) {
      const value = i * upward;
      g.beginPath();
      g.moveTo(px(0), py(value));
      g.lineTo(px(end), py(value));
      g.stroke();
      g.textAlign = 'right';
      g.fillText(compact(value), left - 6 * u, py(value) + 4 * u);
    }
    g.strokeStyle = ctx.token('--screen-dim');
    g.setLineDash([5 * u, 4 * u]);
    g.beginPath();
    g.moveTo(px(0), py(1));
    g.lineTo(px(end), py(1));
    g.stroke();
    g.setLineDash([]);

    const shown = Math.ceil(cursor * (t.length - 1));
    g.strokeStyle = ctx.token('--screen-ink');
    g.lineWidth = 2 * u;
    g.lineJoin = 'round';
    g.beginPath();
    const stride = Math.max(1, Math.floor(t.length / 800));
    for (let i = 0; i <= shown; i += i + stride > shown && i < shown ? shown - i : stride) {
      if (i) g.lineTo(px(t[i]), py(y[i]));
      else g.moveTo(px(t[i]), py(y[i]));
    }
    g.stroke();

    const period = state.T as number;
    if (px(period) - px(0) >= 7 * u) {
      g.fillStyle = ctx.token('--screen-accent');
      for (let k = 0; k * period <= t[shown]; k++) {
        const i = Math.round(((k * period) / end) * (t.length > 2 ? 4000 : 1));
        if (i >= y.length) break;
        g.beginPath();
        g.arc(px(k * period), py(y[i]), 2.2 * u, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (cursor < 1) {
      g.fillStyle = ctx.token('--screen-accent');
      g.beginPath();
      g.arc(px(t[shown]), py(y[shown]), 5 * u, 0, Math.PI * 2);
      g.fill();
    }
  }

  function frame(r: { x: number; y: number; w: number; h: number }, reach: number): Plane {
    const u = unit();
    return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 + 7 * u, scale: (Math.min(r.w, r.h - 16 * u) / 2 - 8 * u) / reach, reach };
  }

  function drawMark(p: Plane, at: Complex, kind: 'pole' | 'zero') {
    const u = unit();
    const x = p.cx + at.re * p.scale;
    const y = p.cy - at.im * p.scale;
    const size = 5 * u;
    g.strokeStyle = ctx.token('--screen-accent');
    g.lineWidth = 2 * u;
    g.beginPath();
    if (kind === 'pole') {
      g.moveTo(x - size, y - size);
      g.lineTo(x + size, y + size);
      g.moveTo(x + size, y - size);
      g.lineTo(x - size, y + size);
    } else {
      g.arc(x, y, size, 0, Math.PI * 2);
    }
    g.stroke();
    return { x, y };
  }

  function drawMap(r: { x: number; y: number; w: number; h: number }, name: string, reach: number, list: { poles: Complex[]; zeros: Complex[] }, circle: boolean): Plane {
    const u = unit();
    const p = frame(r, reach);
    const half = reach * p.scale;
    g.save();
    g.beginPath();
    g.rect(p.cx - half, p.cy - half, half * 2, half * 2);
    g.clip();
    g.fillStyle = ctx.token('--screen-faint');
    if (circle) {
      g.beginPath();
      g.arc(p.cx, p.cy, p.scale, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(p.cx - half, p.cy - half, half, half * 2);
    }
    g.strokeStyle = ctx.token('--screen-dim');
    g.lineWidth = u;
    g.beginPath();
    g.moveTo(p.cx - half, p.cy);
    g.lineTo(p.cx + half, p.cy);
    g.moveTo(p.cx, p.cy - half);
    g.lineTo(p.cx, p.cy + half);
    g.stroke();
    g.restore();
    list.zeros.forEach((at) => drawMark(p, at, 'zero'));
    list.poles.forEach((at) => drawMark(p, at, 'pole'));
    g.fillStyle = ctx.token('--screen-ink');
    g.font = text(11);
    g.textAlign = 'left';
    g.fillText(name, r.x + 6 * u, r.y + 13 * u);
    g.textAlign = 'right';
    g.fillText(`±${compact(reach)}`, r.x + r.w - 6 * u, r.y + 13 * u);
    return p;
  }

  function drawSurface(r: { x: number; y: number; w: number; h: number }, name: string, heights: number[][], reach: number, ridge: (re: number, im: number) => boolean) {
    const u = unit();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h * 0.44;
    const size = Math.min(r.w, r.h * 1.3) * 0.3;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const sinP = Math.sin(pitch);
    const cosP = Math.cos(pitch);
    const project = (i: number, j: number, h: number) => {
      const x = (i / (GRID - 1)) * 2 - 1;
      const y = (j / (GRID - 1)) * 2 - 1;
      const rx = x * cosY - y * sinY;
      const ry = x * sinY + y * cosY;
      return { x: cx + rx * size, y: cy + ry * size * sinP - (h / 1.5) * size * 0.5 * cosP, depth: ry };
    };
    const quads: { i: number; j: number; depth: number }[] = [];
    for (let j = 0; j < GRID - 1; j++) {
      for (let i = 0; i < GRID - 1; i++) quads.push({ i, j, depth: project(i + 0.5, j + 0.5, 0).depth });
    }
    quads.sort((a, b) => a.depth - b.depth);
    g.save();
    g.beginPath();
    g.rect(r.x, r.y, r.w, r.h);
    g.clip();
    g.lineWidth = 0.6 * u;
    g.lineJoin = 'round';
    g.strokeStyle = ctx.token('--screen-ink');
    for (const { i, j } of quads) {
      const a = project(i, j, heights[j][i]);
      const b = project(i + 1, j, heights[j][i + 1]);
      const c = project(i + 1, j + 1, heights[j + 1][i + 1]);
      const d = project(i, j + 1, heights[j + 1][i]);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.lineTo(c.x, c.y);
      g.lineTo(d.x, d.y);
      g.closePath();
      g.fillStyle = ctx.token('--screen-bg');
      g.fill();
      g.stroke();
    }
    g.strokeStyle = ctx.token('--screen-accent');
    g.lineWidth = 2 * u;
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const re = ((i / (GRID - 1)) * 2 - 1) * reach;
        const im = ((j / (GRID - 1)) * 2 - 1) * reach;
        if (!ridge(re, im)) continue;
        const at = project(i, j, heights[j][i]);
        g.beginPath();
        g.arc(at.x, at.y, 0.8 * u, 0, Math.PI * 2);
        g.stroke();
      }
    }
    drawAxes(project, reach);
    g.restore();
    g.fillStyle = ctx.token('--screen-ink');
    g.font = text(11);
    g.textAlign = 'left';
    g.fillText(name, r.x + 6 * u, r.y + 13 * u);
  }

  /** Real and imaginary axes along the two front edges of the floor, and height at the leftmost corner. */
  function drawAxes(project: (i: number, j: number, h: number) => { x: number; y: number; depth: number }, reach: number) {
    const u = unit();
    const last = GRID - 1;
    const floor = -LIMIT;
    const frontJ = project(0, 0, floor).depth > project(0, last, floor).depth ? 0 : last;
    const frontI = project(0, 0, floor).depth > project(last, 0, floor).depth ? 0 : last;
    const corners = [[0, 0], [last, 0], [0, last], [last, last]].map(([i, j]) => ({ i, j, ...project(i, j, floor) }));
    const post = corners.reduce((a, b) => (b.x < a.x ? b : a));
    const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    };
    g.strokeStyle = ctx.token('--screen-ink');
    g.fillStyle = ctx.token('--screen-ink');
    g.lineWidth = 1.2 * u;
    g.font = text(10);
    g.textAlign = 'center';
    line(project(0, frontJ, floor), project(last, frontJ, floor));
    line(project(frontI, 0, floor), project(frontI, last, floor));
    line(project(post.i, post.j, floor), project(post.i, post.j, LIMIT));
    for (const fraction of [0, 0.5, 1]) {
      const along = fraction * last;
      const value = compact((fraction * 2 - 1) * reach);
      const a = project(along, frontJ, floor);
      const b = project(frontI, along, floor);
      // Skip the ends shared with another axis, where labels would land on each other.
      if (along !== frontI && !(along === post.i && frontJ === post.j)) g.fillText(value, a.x, a.y + 12 * u);
      if (along !== frontJ && !(frontI === post.i && along === post.j)) g.fillText(value, b.x, b.y + 12 * u);
    }
    const mid = project(last * 0.75, frontJ, floor);
    const side = project(frontI, last * 0.75, floor);
    g.fillText('Re', mid.x, mid.y + 12 * u);
    g.fillText('Im', side.x, side.y + 12 * u);
    g.textAlign = 'right';
    for (const height of [-LIMIT, 0, LIMIT]) {
      const at = project(post.i, post.j, height);
      line({ x: at.x - 3 * u, y: at.y }, at);
      g.fillText(compact(10 ** height), at.x - 5 * u, at.y + 3 * u);
    }
  }

  const reachS = (list: Complex[]) => Math.max(1, ...list.map((p) => Math.max(Math.abs(p.re), Math.abs(p.im)) * 1.4));
  const reachZ = () => Math.min(4, Math.max(1.4, ...(digital?.poles ?? []).concat(digital?.zeros ?? []).map((p) => Math.max(Math.abs(p.re), Math.abs(p.im)) * 1.15)));

  function drawPlanes() {
    const { s: left, z: right } = area();
    clear(left);
    clear(right);
    markers = [];
    sPlane = undefined;
    if (!system) return;
    const sp = poles(system);
    const sz = zeros(system);
    const rs = reachS([...sp, ...sz]);
    const rz = reachZ();
    if (state.v) {
      if (surfaces.s) drawSurface(left, '|G(s)|, ridge on the jω axis', surfaces.s, rs, (re) => Math.abs(re) < rs / (GRID - 1));
      if (surfaces.z) drawSurface(right, '|G(z)|, ridge on the unit circle', surfaces.z, rz, (re, im) => Math.abs(Math.hypot(re, im) - 1) < rz / (GRID - 1));
      return;
    }
    sPlane = drawMap(left, left.w > 300 * unit() ? 'S plane   × poles   ○ zeros' : 'S plane', rs, { poles: sp, zeros: sz }, false);
    const held = grouped(sp).map((at, index) => ({ at, kind: 'pole' as const, index }));
    const open = grouped(sz).map((at, index) => ({ at, kind: 'zero' as const, index }));
    markers = [...held, ...open].map(({ at, kind, index }) => ({ x: sPlane!.cx + at.re * sPlane!.scale, y: sPlane!.cy - at.im * sPlane!.scale, kind, index }));
    if (digital) {
      drawMap(right, right.w > 300 * unit() ? `Z plane   × poles   ○ zeros` : 'Z plane', rz, digital, true);
    } else {
      g.fillStyle = ctx.token('--screen-alert');
      g.font = text(12);
      g.textAlign = 'center';
      g.fillText('Pole too far out for this T', right.x + right.w / 2, right.y + right.h / 2);
    }
  }

  function grids() {
    surfaces = {};
    if (!state.v || !system) return;
    const line = (reach: number) => Array.from({ length: GRID }, (_, i) => ((i / (GRID - 1)) * 2 - 1) * reach);
    const rs = reachS([...poles(system), ...zeros(system)]);
    surfaces.s = surface(system.num, system.den, line(rs), line(rs));
    if (digital) surfaces.z = surface(digital.num, digital.den, line(reachZ()), line(reachZ()));
  }

  function readouts() {
    const blank = () => ['fv', 'os', 'tp', 'tr', 'ts'].forEach((key) => ctx.setReadout(key, '--'));
    if (!system || !trace) {
      ctx.setReadout('st', 'Check entry');
      blank();
      return;
    }
    const status = stability(poles(system));
    ctx.setReadout('st', status);
    const final = dcGain(system);
    if (status !== 'Stable' || !final) {
      blank();
      return;
    }
    const m = metrics(trace, final);
    ctx.setReadout('fv', compact(final));
    ctx.setReadout('os', m.overshoot.toFixed(1));
    ctx.setReadout('tp', fixed(m.peakTime));
    ctx.setReadout('tr', fixed(m.rise));
    ctx.setReadout('ts', fixed(m.settle));
  }

  function compute() {
    const parsed = parse(state.num as string, state.den as string, state.k as number);
    const invalid = !parsed.ok;
    ctx.root.querySelectorAll('input[type="text"]').forEach((input) => input.setAttribute('aria-invalid', String(invalid)));
    system = parsed.ok ? parsed.system : undefined;
    reason = parsed.ok ? '' : parsed.reason;
    trace = system ? simulate(system, timeSpan(poles(system))) : undefined;
    digital = system ? discretise(system, state.T as number) : undefined;
    grids();
    readouts();
  }

  function redraw() {
    fit(screen);
    drawTime();
    drawPlanes();
  }

  let held: { kind: 'pole' | 'zero'; index: number; poles: Complex[]; zeros: Complex[]; lead: number } | undefined;
  let spinning: { x: number; y: number } | undefined;

  const place = (event: { clientX: number; clientY: number }) => {
    const box = screen.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * screen.width, y: ((event.clientY - box.top) / box.height) * screen.height };
  };
  const hit = (at: { x: number; y: number }) => markers.find((m) => Math.hypot(m.x - at.x, m.y - at.y) < 16 * unit());
  const onPlanes = (at: { y: number }) => at.y > area().s.y;

  function grab(event: PointerEvent) {
    const at = place(event);
    if (state.v) {
      if (!onPlanes(at)) return;
      spinning = at;
    } else {
      const marker = hit(at);
      if (!marker || !system) return;
      held = { kind: marker.kind, index: marker.index, poles: grouped(poles(system)), zeros: grouped(zeros(system)), lead: system.num[0] / (state.k as number) };
    }
    screen.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    const at = place(event);
    if (spinning) {
      yaw += ((at.x - spinning.x) / screen.width) * 4;
      pitch = Math.min(1.45, Math.max(0.2, pitch + ((at.y - spinning.y) / screen.height) * 3));
      spinning = at;
      drawPlanes();
      return;
    }
    if (!held || !sPlane) {
      if (!state.v) screen.style.cursor = hit(at) ? 'grab' : '';
      return;
    }
    const target = { re: (at.x - sPlane.cx) / sPlane.scale, im: (sPlane.cy - at.y) / sPlane.scale };
    const list = held.kind === 'pole' ? held.poles : held.zeros;
    const paired = list[held.index].im !== 0;
    list[held.index] = { re: target.re, im: paired ? Math.max(0.01, Math.abs(target.im)) : 0 };
    ctx.set({
      num: coefficients(fromRoots(ungrouped(held.zeros)).map((c) => c * held!.lead)),
      den: coefficients(fromRoots(ungrouped(held.poles))),
    });
  }

  const release = () => {
    held = undefined;
    spinning = undefined;
  };

  screen.addEventListener('pointerdown', grab);
  screen.addEventListener('pointermove', move);
  screen.addEventListener('pointerup', release);
  screen.addEventListener('pointercancel', release);
  // A finger on a marker moves the marker; anywhere else it scrolls the page.
  const touch = (event: TouchEvent) => {
    const at = place(event.touches[0]);
    if (state.v ? onPlanes(at) : hit(at)) event.preventDefault();
  };
  screen.addEventListener('touchstart', touch, { passive: false });

  const replay = () => {
    cursor = ctx.reduced ? 1 : 0;
    drawTime();
  };

  ctx.onChange((key) => {
    compute();
    if ((key === null || key === 'preset') && !held) cursor = ctx.reduced ? 1 : 0;
    redraw();
  });
  ctx.onAction((key) => {
    if (key === 'replay') replay();
  });
  const resize = new ResizeObserver(redraw);
  resize.observe(screen);
  const stop = runFrames(ctx.root, (elapsed) => {
    if (cursor >= 1) return;
    cursor = Math.min(1, cursor + elapsed / REPLAY_SECONDS);
    drawTime();
  });
  compute();
  redraw();
  return () => {
    stop();
    resize.disconnect();
  };
};
