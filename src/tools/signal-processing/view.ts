import { fit, type Mount } from '../../lib/instrument/runtime';
import { design as build, type Family, type Response, type Section } from '../../lib/instrument/filters';
import type { Complex } from '../../lib/instrument/signal';
import { Speaker } from './audio';
import {
  NYQUIST, RATE, SPECTRUM_SIZE, alias, apply, biquad, decibels, gainAt, handmade, mixed, orderOf, polesOf, spectrum, zerosOf,
  type FilterKind, type Mix, type Pair, type Wave,
} from './model';

const WINDOW_SAMPLES = 160;
const FLOOR_DB = -70;
/** Keeps titles clear of the rounded corners of the glass. */
const EDGE = 12;
const CUSTOM = ['p1r', 'p1a', 'p2r', 'p2a', 'z1r', 'z1a', 'z2r', 'z2a'];
const MARKS = ['p1', 'p2', 'z1', 'z2'];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const mount: Mount = (ctx) => {
  const { state, screen } = ctx;
  const drawing = screen.getContext('2d');
  if (!drawing) throw new Error('No 2D canvas');
  const g = drawing;
  const speaker = new Speaker();

  let sections: Section[] = [];
  let input: Float64Array = new Float64Array(RATE);
  let output: Float64Array = new Float64Array(RATE);
  let before: Float64Array = new Float64Array(SPECTRUM_SIZE / 2 + 1);
  let after: Float64Array = before;
  let plane: { cx: number; cy: number; scale: number } | undefined;
  let held: string | undefined;
  let soundTimer = 0;

  const unit = () => Math.min(devicePixelRatio || 1, 2);
  const pairOf = (key: string): Pair => ({ radius: state[`${key}r`] as number, hz: state[`${key}a`] as number });

  function design(): Section[] {
    const kind = state.t as FilterKind;
    if (kind === 'off') return [];
    if (kind === 'custom') return handmade([pairOf('p1'), pairOf('p2')], [pairOf('z1'), pairOf('z2')]);
    const response = state.r as Response;
    if (kind === 'biquad') return [biquad(response, state.c as number, state.q as number)];
    return build({
      family: kind as Family,
      response,
      order: state.n as number,
      cutoff: (state.c as number) / RATE,
      width: (state.b as number) / RATE,
      ripple: state.rp as number,
      stopband: state.rs as number,
    });
  }

  function compute() {
    sections = design();
    const one = { wave: state.w1 as Wave, frequency: state.f1 as number, level: state.l1 as number };
    const two = { wave: state.w2 as Wave, frequency: state.f2 as number, level: state.l2 as number };
    input = mixed(one, two, state.m as Mix);
    output = apply(sections, input);
    before = spectrum(input);
    after = spectrum(output);
    const kind = state.t as FilterKind;
    const toggle = (key: string, hide: boolean) => ctx.root.querySelector(`[data-param="${key}"]`)?.closest('.control')?.toggleAttribute('hidden', hide);
    CUSTOM.forEach((key) => toggle(key, kind !== 'custom'));
    const classic = kind !== 'off' && kind !== 'custom';
    const banded = state.r === 'bandpass' || state.r === 'bandstop';
    ['r', 'c'].forEach((key) => toggle(key, !classic));
    toggle('n', !classic || kind === 'biquad');
    toggle('b', !classic || kind === 'biquad' || !banded);
    toggle('rp', kind !== 'chebyshev1' && kind !== 'elliptic');
    toggle('rs', kind !== 'chebyshev2' && kind !== 'elliptic');
    toggle('q', kind !== 'biquad');
    ctx.setReadout('or', kind === 'off' ? '--' : String(orderOf(sections)));
    ['1', '2'].forEach((n) => toggle(`f${n}`, state[`w${n}`] === 'noise'));
    const tones = ([1, 2] as const).filter((n) => state[`w${n}`] !== 'noise' && (state[`l${n}`] as number) > 0);
    const folded = tones.some((n) => (state[`f${n}`] as number) > NYQUIST);
    ctx.setReadout('st', folded ? 'Aliasing' : 'Clean');
    ([1, 2] as const).forEach((n) => {
      const hz = state[`f${n}`] as number;
      const heard = tones.includes(n);
      ctx.setReadout(`h${n}`, heard ? String(alias(hz)) : '--');
      ctx.setReadout(`g${n}`, heard ? decibels(gainAt(sections, alias(hz))).toFixed(1).replace(/^-0\.0$/, '0.0') : '--');
    });
    if (speaker.playing) {
      clearTimeout(soundTimer);
      soundTimer = window.setTimeout(() => speaker.update(output), 80);
    }
  }

  function font(px: number) {
    g.font = `${px * unit()}px ${ctx.token('--f-mono')}`;
  }

  function title(box: Box, text: string) {
    const u = unit();
    g.fillStyle = ctx.token('--screen-ink');
    font(11);
    g.textAlign = 'left';
    g.fillText(text, box.x + 4 * u, box.y + 12 * u);
  }

  function frame(box: Box) {
    const u = unit();
    return { left: box.x + 4 * u, right: box.x + box.w - 4 * u, top: box.y + 18 * u, bottom: box.y + box.h - 16 * u };
  }

  function hzAxis(box: Box) {
    const u = unit();
    const { left, right, top, bottom } = frame(box);
    const px = (hz: number) => left + (hz / NYQUIST) * (right - left);
    g.strokeStyle = ctx.token('--screen-faint');
    g.fillStyle = ctx.token('--screen-ink');
    g.lineWidth = u;
    font(10);
    for (let hz = 0; hz <= NYQUIST; hz += 1000) {
      g.beginPath();
      g.moveTo(px(hz), top);
      g.lineTo(px(hz), bottom);
      g.stroke();
      g.textAlign = hz === 0 ? 'left' : hz === NYQUIST ? 'right' : 'center';
      g.fillText(`${hz / 1000}k`, px(hz), bottom + 12 * u);
    }
    return px;
  }

  function dbScale(box: Box) {
    const u = unit();
    const { left, right, top, bottom } = frame(box);
    const py = (db: number) => top + (Math.max(FLOOR_DB, Math.min(0, db)) / FLOOR_DB) * (bottom - top);
    g.strokeStyle = ctx.token('--screen-faint');
    g.fillStyle = ctx.token('--screen-ink');
    font(10);
    g.textAlign = 'right';
    for (let db = 0; db >= FLOOR_DB; db -= 20) {
      g.beginPath();
      g.moveTo(left, py(db));
      g.lineTo(right, py(db));
      g.stroke();
      g.fillText(`${db}`, right - 2 * u, py(db) + (db ? -2 : 10) * u);
    }
    return py;
  }

  function waveform(box: Box) {
    const u = unit();
    title(box, 'Waveform, 20 ms');
    const { left, right, top, bottom } = frame(box);
    const middle = (top + bottom) / 2;
    const reach = Math.max(1, ...input.slice(0, WINDOW_SAMPLES).map(Math.abs), ...output.slice(0, WINDOW_SAMPLES).map(Math.abs));
    const line = (signal: Float64Array, colour: string, width: number) => {
      g.strokeStyle = colour;
      g.lineWidth = width * u;
      g.beginPath();
      for (let i = 0; i < WINDOW_SAMPLES; i++) {
        const x = left + (i / (WINDOW_SAMPLES - 1)) * (right - left);
        const y = middle - (signal[i] / reach) * (bottom - top) * 0.48;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    };
    g.strokeStyle = ctx.token('--screen-faint');
    g.lineWidth = u;
    g.beginPath();
    g.moveTo(left, middle);
    g.lineTo(right, middle);
    g.stroke();
    line(input, ctx.token('--screen-dim'), 1);
    line(output, ctx.token('--screen-accent'), 1.6);
  }

  function spectra(box: Box) {
    const u = unit();
    title(box, box.w > 300 * u ? 'Spectrum, dB: before and after' : 'Spectrum, dB');
    const px = hzAxis(box);
    const py = dbScale(box);
    const line = (values: Float64Array, colour: string, width: number) => {
      g.strokeStyle = colour;
      g.lineWidth = width * u;
      g.beginPath();
      values.forEach((value, i) => {
        const x = px((i * RATE) / SPECTRUM_SIZE);
        if (i) g.lineTo(x, py(value));
        else g.moveTo(x, py(value));
      });
      g.stroke();
    };
    line(before, ctx.token('--screen-dim'), 1);
    line(after, ctx.token('--screen-accent'), 1.2);
  }

  function responseCurve(box: Box) {
    const u = unit();
    title(box, 'Filter gain, dB');
    const px = hzAxis(box);
    const py = dbScale(box);
    g.strokeStyle = ctx.token('--screen-accent');
    g.lineWidth = 2 * u;
    g.beginPath();
    for (let hz = 0; hz <= NYQUIST; hz += 10) {
      const y = py(decibels(gainAt(sections, hz)));
      if (hz) g.lineTo(px(hz), y);
      else g.moveTo(px(hz), y);
    }
    g.stroke();
  }

  function mark(at: Complex, kind: 'pole' | 'zero') {
    const u = unit();
    const { cx, cy, scale } = plane!;
    const x = cx + at.re * scale;
    const y = cy - at.im * scale;
    const size = 4.5 * u;
    g.strokeStyle = ctx.token('--screen-alert');
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
  }

  function zPlane(box: Box) {
    const u = unit();
    title(box, box.w > 300 * u ? 'Z plane   × poles   ○ zeros' : 'Z plane');
    const { left, right, top, bottom } = frame({ ...box, h: box.h + 12 * u });
    const reach = 1.3;
    plane = { cx: (left + right) / 2, cy: (top + bottom) / 2, scale: Math.min(right - left, bottom - top) / (2 * reach) };
    const { cx, cy, scale } = plane;
    g.strokeStyle = ctx.token('--screen-dim');
    g.lineWidth = u;
    g.beginPath();
    g.moveTo(cx - reach * scale, cy);
    g.lineTo(cx + reach * scale, cy);
    g.moveTo(cx, cy - reach * scale);
    g.lineTo(cx, cy + reach * scale);
    g.stroke();
    g.strokeStyle = ctx.token('--screen-ink');
    g.beginPath();
    g.arc(cx, cy, scale, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = ctx.token('--screen-ink');
    font(10);
    g.textAlign = 'left';
    g.fillText('0', cx + scale + 3 * u, cy - 3 * u);
    g.textAlign = 'right';
    g.fillText('4k', cx - scale - 3 * u, cy - 3 * u);
    zerosOf(sections).forEach((z) => mark(z, 'zero'));
    polesOf(sections).forEach((z) => mark(z, 'pole'));
  }

  function draw() {
    fit(screen);
    const u = unit();
    const { width: w, height: h } = screen;
    g.fillStyle = ctx.token('--screen-bg');
    g.fillRect(0, 0, w, h);
    const gap = 8 * u;
    const edge = EDGE * u;
    const halfW = (w - 2 * edge - gap) / 2;
    const halfH = (h - 2 * edge - gap) / 2;
    const far = { x: edge + halfW + gap, y: edge + halfH + gap };
    waveform({ x: edge, y: edge, w: halfW, h: halfH });
    spectra({ x: far.x, y: edge, w: halfW, h: halfH });
    responseCurve({ x: edge, y: far.y, w: halfW, h: halfH });
    zPlane({ x: far.x, y: far.y, w: halfW, h: halfH });
  }

  const place = (event: { clientX: number; clientY: number }) => {
    const box = screen.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * screen.width, y: ((event.clientY - box.top) / box.height) * screen.height };
  };

  function hit(at: { x: number; y: number }) {
    if (state.t !== 'custom' || !plane) return undefined;
    const { cx, cy, scale } = plane;
    return MARKS.find((key) => {
      const { radius, hz } = pairOf(key);
      if (!radius) return false;
      const angle = (2 * Math.PI * hz) / RATE;
      const x = cx + radius * Math.cos(angle) * scale;
      return [1, -1].some((side) => Math.hypot(x - at.x, cy - side * radius * Math.sin(angle) * scale - at.y) < 16 * unit());
    });
  }

  screen.addEventListener('pointerdown', (event) => {
    held = hit(place(event));
    if (held) screen.setPointerCapture(event.pointerId);
  });
  screen.addEventListener('pointermove', (event) => {
    const at = place(event);
    if (!held || !plane) {
      screen.style.cursor = hit(at) ? 'grab' : '';
      return;
    }
    const re = (at.x - plane.cx) / plane.scale;
    const im = (plane.cy - at.y) / plane.scale;
    const reach = held.startsWith('p') ? 0.98 : 1.5;
    ctx.set({
      [`${held}r`]: Math.round(Math.min(reach, Math.hypot(re, im)) * 100) / 100,
      [`${held}a`]: Math.round((Math.atan2(Math.abs(im), re) * RATE) / (2 * Math.PI) / 10) * 10,
    });
  });
  const drop = () => {
    held = undefined;
  };
  screen.addEventListener('pointerup', drop);
  screen.addEventListener('pointercancel', drop);
  // A finger on a marker moves the marker; anywhere else it scrolls the page.
  screen.addEventListener('touchstart', (event) => {
    if (hit(place(event.touches[0]))) event.preventDefault();
  }, { passive: false });

  const toggle = ctx.root.querySelector<HTMLInputElement>('[data-toggle="sound"]');
  const silence = () => {
    speaker.stop();
    ctx.root.dataset.sound = 'off';
    if (toggle) toggle.checked = false;
  };
  ctx.onAction(async (key) => {
    if (key !== 'sound') return;
    if (toggle?.checked) await speaker.play(output);
    else speaker.stop();
    ctx.root.dataset.sound = speaker.playing ? 'on' : 'off';
  });
  const hidden = () => {
    if (document.hidden) silence();
  };
  document.addEventListener('visibilitychange', hidden);
  addEventListener('pagehide', silence);

  ctx.onChange(() => {
    compute();
    draw();
  });
  const resize = new ResizeObserver(draw);
  resize.observe(screen);
  compute();
  draw();
  return () => {
    silence();
    resize.disconnect();
    document.removeEventListener('visibilitychange', hidden);
    removeEventListener('pagehide', silence);
  };
};
