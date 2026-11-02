import { fit, runFrames, type Mount } from '../../lib/instrument/runtime';
import { DT, SPAN, convolve, outputAt, signal, type Definition, type Result, type Shape, type Signal } from './model';

const SWEEP_SECONDS = 9;

const compact = (value: number) => (Math.abs(value) >= 1000 ? value.toExponential(1) : Number(value.toPrecision(3)).toString());

function ticks(range: number, divisions: number) {
  const rough = range / divisions;
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].find((step) => step * power >= rough)! * power;
}

export const mount: Mount = (ctx) => {
  const { state, screen } = ctx;
  const drawing = screen.getContext('2d');
  if (!drawing) throw new Error('No 2D canvas');
  const g = drawing;

  let f: Signal;
  let h: Signal;
  let result: Result;
  let signature = '';
  let playing = false;
  const unit = () => Math.min(devicePixelRatio || 1, 2);
  const definition = (key: 'f' | 'g'): Definition => ({
    shape: state[`${key}s`] as Shape,
    width: state[`${key}w`] as number,
    height: state[`${key}a`] as number,
    formula: state[`${key}f`] as string,
  });

  function compute() {
    const next = JSON.stringify(['fs', 'fw', 'fa', 'ff', 'gs', 'gw', 'ga', 'gf'].map((key) => state[key]));
    if (next === signature) return false;
    signature = next;
    f = signal(definition('f'));
    h = signal(definition('g'));
    result = convolve(f, h);
    for (const key of ['f', 'g'] as const) {
      const formula = ctx.root.querySelector(`[data-param="${key}f"]`);
      formula?.closest('.control')?.toggleAttribute('hidden', state[`${key}s`] !== 'formula');
      formula?.setAttribute('aria-invalid', String(Boolean((key === 'f' ? f : h).error)));
      const shape = state[`${key}s`] as Shape;
      ctx.root.querySelector(`[data-param="${key}w"]`)?.closest('.control')?.toggleAttribute('hidden', ['formula', 'impulse', 'step'].includes(shape));
      ctx.root.querySelector(`[data-param="${key}a"]`)?.closest('.control')?.toggleAttribute('hidden', shape === 'formula');
    }
    ctx.setReadout('pk', compact(result.peak));
    ctx.setReadout('af', compact(result.areaF));
    ctx.setReadout('ag', compact(result.areaG));
    ctx.setReadout('ay', compact(result.areaF * result.areaG));
    return true;
  }

  function draw() {
    fit(screen);
    const u = unit();
    const { width: w, height: full } = screen;
    const position = state.p as number;
    ctx.setReadout('y', compact(outputAt(result, position)));
    g.fillStyle = ctx.token('--screen-bg');
    g.fillRect(0, 0, w, full);
    g.font = `${11 * u}px ${ctx.token('--f-mono')}`;

    const left = 40 * u;
    const right = w - 12 * u;
    const split = full * 0.54;
    const px = (t: number) => left + ((t + SPAN) / (2 * SPAN)) * (right - left);

    const grid = (top: number, bottom: number, low: number, high: number) => {
      const py = (value: number) => bottom - ((value - low) / (high - low)) * (bottom - top);
      g.lineWidth = u;
      g.strokeStyle = ctx.token('--screen-faint');
      g.fillStyle = ctx.token('--screen-ink');
      g.textAlign = 'center';
      for (let t = -SPAN; t <= SPAN; t += 2) {
        g.beginPath();
        g.moveTo(px(t), top);
        g.lineTo(px(t), bottom);
        g.stroke();
        g.fillText(String(t), px(t), bottom + 13 * u);
      }
      const step = ticks(high - low, 3);
      g.textAlign = 'right';
      for (let i = Math.ceil(low / step); i * step <= high; i++) {
        const value = i * step;
        g.beginPath();
        g.moveTo(left, py(value));
        g.lineTo(right, py(value));
        g.stroke();
        g.fillText(compact(value), left - 5 * u, py(value) + 4 * u);
      }
      return py;
    };

    const curve = (read: (t: number) => number, py: (value: number) => number, top: number, bottom: number) => {
      g.save();
      g.beginPath();
      g.rect(left, top, right - left, bottom - top);
      g.clip();
      g.beginPath();
      const steps = Math.round((2 * SPAN) / DT);
      for (let i = 0; i <= steps; i++) {
        const t = -SPAN + i * DT;
        if (i) g.lineTo(px(t), py(read(t)));
        else g.moveTo(px(t), py(read(t)));
      }
      g.stroke();
      g.restore();
    };

    const top = 20 * u;
    const bottom = split - 18 * u;
    const scale = Math.max(f.peak, h.peak) * 1.15;
    const signed = hasNegative();
    const py = grid(top, bottom, signed ? -scale : -0.05 * scale, scale);

    // The shaded area is the integrand, and its area is the output at this position.
    g.save();
    g.beginPath();
    g.rect(left, top, right - left, bottom - top);
    g.clip();
    g.fillStyle = ctx.token('--screen-accent');
    g.globalAlpha = 0.35;
    g.beginPath();
    g.moveTo(px(-SPAN), py(0));
    const steps = Math.round((2 * SPAN) / DT);
    for (let i = 0; i <= steps; i++) {
      const tau = -SPAN + i * DT;
      g.lineTo(px(tau), py(f.at(tau) * h.at(position - tau)));
    }
    g.lineTo(px(SPAN), py(0));
    g.closePath();
    g.fill();
    g.restore();

    g.lineWidth = 2 * u;
    g.strokeStyle = ctx.token('--screen-ink');
    curve(f.at, py, top, bottom);
    g.strokeStyle = ctx.token('--screen-alert');
    curve((tau) => h.at(position - tau), py, top, bottom);

    const low = Math.min(0, ...result.y);
    const high = Math.max(0, ...result.y);
    const room = (high - low || 1) * 0.1;
    const outTop = split + 8 * u;
    const outBottom = full - 18 * u;
    const out = grid(outTop, outBottom, low - room, high + room);
    g.lineWidth = u;
    g.strokeStyle = ctx.token('--screen-dim');
    curve((t) => outputAt(result, t), out, outTop, outBottom);
    g.lineWidth = 2.5 * u;
    g.strokeStyle = ctx.token('--screen-accent');
    g.beginPath();
    for (let i = 0; result.t[i] <= position && i < result.t.length; i += 2) {
      const x = px(result.t[i]);
      const y = out(result.y[i]);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();

    g.lineWidth = u;
    g.strokeStyle = ctx.token('--screen-accent');
    g.setLineDash([4 * u, 4 * u]);
    g.beginPath();
    g.moveTo(px(position), top);
    g.lineTo(px(position), outBottom);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = ctx.token('--screen-accent');
    g.beginPath();
    g.arc(px(position), out(outputAt(result, position)), 4 * u, 0, Math.PI * 2);
    g.fill();

    g.textAlign = 'left';
    g.fillStyle = ctx.token('--screen-ink');
    g.fillText('f(τ)', left + 4 * u, 13 * u);
    g.fillStyle = ctx.token('--screen-alert');
    g.fillText('g(t − τ)', left + 48 * u, 13 * u);
    g.fillStyle = ctx.token('--screen-accent');
    g.fillText(w > 560 * u ? 'shaded: their product' : 'shaded: product', left + 118 * u, 13 * u);
    g.fillText('y(t) = area of the product', left + 4 * u, outTop + 3 * u);
  }

  function hasNegative() {
    for (let t = -SPAN; t <= SPAN; t += 0.1) if (f.at(t) < 0 || h.at(t) < 0) return true;
    return false;
  }

  const seek = (event: PointerEvent) => {
    const box = screen.getBoundingClientRect();
    const u = unit();
    const left = 40 * u;
    const x = ((event.clientX - box.left) / box.width) * screen.width;
    const t = ((x - left) / (screen.width - 12 * u - left)) * (2 * SPAN) - SPAN;
    playing = false;
    ctx.set({ p: Math.round(Math.max(-SPAN, Math.min(SPAN, t)) * 50) / 50 });
  };
  let seeking = false;
  screen.addEventListener('pointerdown', (event) => {
    seeking = true;
    screen.setPointerCapture(event.pointerId);
    seek(event);
  });
  screen.addEventListener('pointermove', (event) => {
    if (seeking) seek(event);
  });
  screen.addEventListener('pointerup', () => {
    seeking = false;
  });
  screen.addEventListener('pointercancel', () => {
    seeking = false;
  });

  ctx.onChange((key) => {
    if (key === 'p') playing = false;
    // Changing a function by hand starts the sweep over, so the new result draws from the beginning. A link keeps its own position.
    if (compute() && key !== null && !ctx.reduced) {
      playing = true;
      ctx.set({ p: -SPAN });
      return;
    }
    draw();
  });
  ctx.onAction((key) => {
    if (key !== 'play') return;
    playing = !playing;
    if (playing && (state.p as number) >= SPAN) ctx.set({ p: -SPAN });
  });
  const resize = new ResizeObserver(draw);
  resize.observe(screen);
  const stop = runFrames(ctx.root, (elapsed) => {
    if (!playing) return;
    const next = (state.p as number) + (elapsed / SWEEP_SECONDS) * 2 * SPAN;
    if (next >= SPAN) playing = false;
    ctx.set({ p: Math.min(SPAN, next) });
  });
  compute();
  draw();
  // A shared link opens where it was left. Otherwise, it starts by showing the idea.
  if (!ctx.reduced && !location.hash && ctx.root.dataset.permalink !== undefined) {
    ctx.set({ p: -SPAN });
    playing = true;
  }
  return () => {
    stop();
    resize.disconnect();
  };
};
