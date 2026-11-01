import { fit, type Mount } from '../../lib/instrument/runtime';
import { horizon, metrics, response } from './model';

export const mount: Mount = (ctx) => {
  const { state, screen } = ctx;
  const g = screen.getContext('2d');
  if (!g) throw new Error('No 2D canvas');

  function plot(zeta: number, wn: number) {
    fit(screen);
    const { width: w, height: h } = screen;
    const unit = Math.min(devicePixelRatio || 1, 2);
    const pad = 34 * unit;
    const end = horizon({ zeta, wn }) * 0.8;
    const yMax = 1.8;
    const px = (t: number) => pad + (t / end) * (w - pad - 12 * unit);
    const py = (y: number) => h - pad - (y / yMax) * (h - pad - 12 * unit);

    g!.fillStyle = ctx.token('--screen-bg');
    g!.fillRect(0, 0, w, h);
    g!.font = `${11 * unit}px "IBM Plex Mono", monospace`;
    g!.lineWidth = unit;

    g!.strokeStyle = ctx.token('--screen-faint');
    g!.fillStyle = ctx.token('--screen-ink');
    for (let i = 0; i <= 5; i++) {
      const t = (i / 5) * end;
      g!.beginPath();
      g!.moveTo(px(t), py(0));
      g!.lineTo(px(t), py(yMax));
      g!.stroke();
      g!.textAlign = 'center';
      g!.fillText(t.toPrecision(2), px(t), h - pad + 16 * unit);
    }
    for (let y = 0; y <= yMax + 1e-9; y += 0.2) {
      g!.beginPath();
      g!.moveTo(px(0), py(y));
      g!.lineTo(px(end), py(y));
      g!.stroke();
      if (Math.round(y * 10) % 4 === 0) {
        g!.textAlign = 'right';
        g!.fillText(y.toFixed(1), pad - 6 * unit, py(y) + 4 * unit);
      }
    }
    g!.fillStyle = ctx.token('--screen-dim');
    g!.globalAlpha = 0.3;
    g!.fillRect(px(0), py(1.02), px(end) - px(0), py(0.98) - py(1.02));
    g!.globalAlpha = 1;

    g!.strokeStyle = ctx.token('--screen-ink');
    g!.lineWidth = 2 * unit;
    g!.lineJoin = 'round';
    g!.beginPath();
    const samples = 600;
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * end;
      if (i) g!.lineTo(px(t), py(response({ zeta, wn }, t)));
      else g!.moveTo(px(t), py(0));
    }
    g!.stroke();
  }

  function update() {
    const zeta = state.z as number;
    const wn = state.w as number;
    const m = metrics({ zeta, wn });
    ctx.setReadout('os', m.overshoot.toFixed(1));
    ctx.setReadout('tp', Number.isFinite(m.peakTime) ? m.peakTime.toFixed(2) : 'none');
    ctx.setReadout('tr', m.rise.toFixed(2));
    ctx.setReadout('ts', m.settle.toFixed(2));
    plot(zeta, wn);
  }

  ctx.onChange(update);
  const resize = new ResizeObserver(update);
  resize.observe(screen);
  update();
  return () => resize.disconnect();
};
