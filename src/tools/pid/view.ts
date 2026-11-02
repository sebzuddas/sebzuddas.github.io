import { fit, runFrames, type Mount } from '../../lib/instrument/runtime';
import { Stepper } from '../../lib/instrument/stepper';
import { AMBIENT, DT, Loop, tunings, type LoopSettings, type PlantName } from './model';

const WINDOW = 30;
const SAMPLE_EVERY = 5;
/** Length of run drawn at once when motion is reduced. */
const STATIC_SECONDS = 25;

const units: Record<PlantName, { suffix: string; scale: number; digits: number }> = {
  heater: { suffix: '°C', scale: 1, digits: 1 },
  pendulum: { suffix: '°', scale: 180 / Math.PI, digits: 1 },
  spring: { suffix: 'm', scale: 1, digits: 2 },
};

interface Point {
  t: number;
  y: number;
  r: number;
  u: number;
}

export const mount: Mount = (ctx) => {
  const { state, screen } = ctx;
  const drawing = screen.getContext('2d');
  if (!drawing) throw new Error('No 2D canvas');
  const g = drawing;

  const settings = (): LoopSettings => ({
    kp: state.kp as number,
    ki: state.ki as number,
    kd: state.kd as number,
    closed: state.cl as boolean,
    antiWindup: state.aw as boolean,
    setting: state.s as number,
  });

  let loop = new Loop(state.p as PlantName, settings());
  let history: Point[] = [];
  let stepper: Stepper;
  let internal = false;

  const tick = () => {
    if (loop.failed) return;
    loop.step();
    if (Math.round(loop.time / DT) % SAMPLE_EVERY === 0) {
      const { scale } = units[loop.name];
      history.push({ t: loop.time, y: loop.measured * scale, r: loop.target * scale, u: loop.output / loop.limit });
      const oldest = loop.time - WINDOW;
      while (history.length && history[0].t < oldest) history.shift();
    }
  };

  function restart() {
    loop = new Loop(state.p as PlantName, settings());
    history = [];
    stepper = new Stepper(DT, tick, 40);
    if (ctx.reduced) for (let i = 0; i < STATIC_SECONDS / DT; i++) tick();
  }

  const unit = () => Math.min(devicePixelRatio || 1, 2);

  function room(w: number, h: number) {
    const u = unit();
    const { output, measured } = loop;
    const left = w * 0.2;
    const right = w * 0.8;
    const top = 26 * u;
    const bottom = h - 18 * u;
    const warmth = Math.max(0, Math.min(1, (measured - AMBIENT) / 60));
    g.fillStyle = ctx.token('--screen-accent');
    g.globalAlpha = warmth * 0.3;
    g.fillRect(left, top, right - left, bottom - top);
    g.globalAlpha = 1;
    g.strokeStyle = ctx.token('--screen-ink');
    g.lineWidth = 3 * u;
    g.strokeRect(left, top, right - left, bottom - top);
    const bars = 6;
    const unitWidth = (right - left) * 0.34;
    const baseX = left + 16 * u;
    for (let i = 0; i < bars; i++) {
      const x = baseX + (i * unitWidth) / bars;
      g.fillStyle = ctx.token('--screen-ink');
      g.fillRect(x, bottom - (bottom - top) * 0.5, unitWidth / bars - 3 * u, (bottom - top) * 0.46);
      g.fillStyle = ctx.token('--screen-accent');
      g.globalAlpha = output / 100;
      g.fillRect(x, bottom - (bottom - top) * 0.5, unitWidth / bars - 3 * u, (bottom - top) * 0.46);
      g.globalAlpha = 1;
    }
    const tubeX = right - 34 * u;
    const tubeTop = top + 14 * u;
    const tubeHeight = bottom - top - 28 * u;
    const reading = (value: number) => tubeTop + tubeHeight * (1 - (value - 15) / 75);
    g.strokeStyle = ctx.token('--screen-ink');
    g.lineWidth = 2 * u;
    g.strokeRect(tubeX, tubeTop, 12 * u, tubeHeight);
    g.fillStyle = ctx.token('--screen-accent');
    g.fillRect(tubeX, reading(measured), 12 * u, tubeTop + tubeHeight - reading(measured));
    g.strokeStyle = ctx.token('--screen-ink');
    g.beginPath();
    g.moveTo(tubeX - 8 * u, reading(loop.target));
    g.lineTo(tubeX + 20 * u, reading(loop.target));
    g.stroke();
  }

  function cart(w: number, h: number) {
    const u = unit();
    const { state: [angle, , position] } = loop;
    const track = h - 26 * u;
    const middle = w / 2;
    const pixels = 60 * u;
    g.strokeStyle = ctx.token('--screen-ink');
    g.lineWidth = 2 * u;
    g.beginPath();
    g.moveTo(0, track);
    g.lineTo(w, track);
    g.stroke();
    // The view follows the cart, so ticks on the track show how far it has run.
    g.fillStyle = ctx.token('--screen-ink');
    g.font = `${10 * u}px ${ctx.token('--f-mono')}`;
    g.textAlign = 'center';
    const first = Math.floor(position - middle / pixels);
    for (let metre = first; metre <= position + middle / pixels + 1; metre++) {
      const x = middle + (metre - position) * pixels;
      g.beginPath();
      g.moveTo(x, track);
      g.lineTo(x, track + 6 * u);
      g.stroke();
      g.fillText(`${metre}`, x, track + 17 * u);
    }
    const width = 64 * u;
    const height = 24 * u;
    g.fillStyle = ctx.token('--screen-ink');
    g.fillRect(middle - width / 2, track - height - 8 * u, width, height);
    g.beginPath();
    g.arc(middle - width / 3, track - 5 * u, 5 * u, 0, Math.PI * 2);
    g.arc(middle + width / 3, track - 5 * u, 5 * u, 0, Math.PI * 2);
    g.fill();
    const pivot = { x: middle, y: track - height - 8 * u };
    const rod = Math.min(pivot.y - 30 * u, 130 * u);
    const tip = { x: pivot.x + rod * Math.sin(angle), y: pivot.y - rod * Math.cos(angle) };
    g.strokeStyle = ctx.token('--screen-accent');
    g.lineWidth = 5 * u;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pivot.x, pivot.y);
    g.lineTo(tip.x, tip.y);
    g.stroke();
    g.lineCap = 'butt';
    g.fillStyle = ctx.token('--screen-accent');
    g.beginPath();
    g.arc(tip.x, tip.y, 8 * u, 0, Math.PI * 2);
    g.fill();
    if (Math.abs(loop.output) > 0.5) {
      const reach = (loop.output / loop.limit) * 60 * u;
      const y = track - height / 2 - 8 * u;
      const start = middle + Math.sign(reach) * (width / 2 + 4 * u);
      g.strokeStyle = ctx.token('--screen-dim');
      g.lineWidth = 3 * u;
      g.beginPath();
      g.moveTo(start, y);
      g.lineTo(start + reach, y);
      g.stroke();
    }
  }

  function spring(w: number, h: number) {
    const u = unit();
    const position = loop.measured;
    const floor = h - 22 * u;
    const size = Math.min(70 * u, h * 0.4);
    const pixels = (w * 0.3);
    const wall = 30 * u;
    const rest = w * 0.5;
    const x = rest + position * pixels;
    const target = rest + loop.target * pixels;
    g.strokeStyle = ctx.token('--screen-ink');
    g.lineWidth = 3 * u;
    g.beginPath();
    g.moveTo(wall, h * 0.12);
    g.lineTo(wall, floor);
    g.lineTo(w - 12 * u, floor);
    g.stroke();
    const coils = 12;
    const y = floor - size / 2;
    g.lineWidth = 2 * u;
    g.beginPath();
    g.moveTo(wall, y);
    for (let i = 1; i < coils; i++) {
      g.lineTo(wall + ((x - size / 2 - wall) * i) / coils, y + (i % 2 ? -1 : 1) * 14 * u);
    }
    g.lineTo(x - size / 2, y);
    g.stroke();
    g.fillStyle = ctx.token('--screen-accent');
    g.fillRect(x - size / 2, floor - size, size, size);
    g.strokeStyle = ctx.token('--screen-ink');
    g.setLineDash([5 * u, 4 * u]);
    g.beginPath();
    g.moveTo(target, h * 0.12);
    g.lineTo(target, floor);
    g.stroke();
    g.setLineDash([]);
  }

  function plot(top: number, w: number, h: number) {
    const u = unit();
    const left = 40 * u;
    const right = w - 12 * u;
    const bottom = h - 18 * u;
    const end = Math.max(WINDOW, loop.time);
    const start = end - WINDOW;
    const px = (t: number) => left + ((t - start) / WINDOW) * (right - left);
    const values = history.flatMap((p) => [p.y, p.r]);
    const reference = loop.target * units[loop.name].scale;
    const low = Math.min(reference, ...values);
    const high = Math.max(reference, ...values);
    const spread = Math.max(high - low, loop.name === 'heater' ? 20 : loop.name === 'pendulum' ? 8 : 1);
    const bottomValue = low - spread * 0.12;
    const topValue = high + spread * 0.12;
    const py = (value: number) => bottom - ((value - bottomValue) / (topValue - bottomValue)) * (bottom - top);
    const rough = (topValue - bottomValue) / 4;
    const power = 10 ** Math.floor(Math.log10(rough || 1));
    const step = [1, 2, 5, 10].find((candidate) => candidate * power >= rough)! * power;

    g.font = `${11 * u}px ${ctx.token('--f-mono')}`;
    g.lineWidth = u;
    g.strokeStyle = ctx.token('--screen-faint');
    g.fillStyle = ctx.token('--screen-ink');
    g.textAlign = 'right';
    for (let i = Math.ceil(bottomValue / step); i * step <= topValue; i++) {
      const value = i * step;
      g.beginPath();
      g.moveTo(left, py(value));
      g.lineTo(right, py(value));
      g.stroke();
      g.fillText(Number(value.toPrecision(3)).toString(), left - 5 * u, py(value) + 4 * u);
    }
    g.textAlign = 'center';
    for (let t = Math.ceil(start / 5) * 5; t <= end; t += 5) {
      g.beginPath();
      g.moveTo(px(t), top);
      g.lineTo(px(t), bottom);
      g.stroke();
      g.fillText(`${t}`, px(t), bottom + 13 * u);
    }
    const trace = (read: (p: Point) => number, colour: string, width: number, dashed = false) => {
      g.strokeStyle = colour;
      g.lineWidth = width * u;
      g.setLineDash(dashed ? [6 * u, 4 * u] : []);
      g.beginPath();
      history.forEach((p, i) => {
        if (i) g.lineTo(px(p.t), read(p));
        else g.moveTo(px(p.t), read(p));
      });
      g.stroke();
      g.setLineDash([]);
    };
    const middle = (top + bottom) / 2;
    trace((p) => middle - p.u * (bottom - top) * 0.46, ctx.token('--screen-dim'), 1);
    trace((p) => py(p.r), ctx.token('--screen-accent'), 1.2, true);
    trace((p) => py(p.y), ctx.token('--screen-ink'), 2);

    const { suffix } = units[loop.name];
    g.font = `${10 * u}px ${ctx.token('--f-mono')}`;
    g.textAlign = 'left';
    g.fillStyle = ctx.token('--screen-ink');
    g.fillText(`measured, ${suffix}`, left + 4 * u, top + 11 * u);
    g.fillStyle = ctx.token('--screen-accent');
    g.fillText('- - target', left + 104 * u, top + 11 * u);
    g.fillStyle = ctx.token('--screen-dim');
    g.fillText('output', left + 178 * u, top + 11 * u);
  }

  function readouts() {
    const { scale, suffix, digits } = units[loop.name];
    const tidy = (text: string) => text.replace(/^-(0(\.0+)?)$/, '$1');
    const show = (value: number) => tidy((value * scale).toFixed(digits));
    ctx.setReadout('st', loop.failed ? 'Fallen' : state.cl ? 'Active' : 'Open loop');
    ctx.setReadout('y', show(loop.measured));
    ctx.setReadout('r', show(loop.target));
    ctx.setReadout('u', tidy(((100 * loop.output) / loop.limit).toFixed(0)));
    ctx.setReadout('t', loop.time.toFixed(1));
    ctx.root.querySelectorAll('.readouts .unit').forEach((node, i) => {
      if (i === 0 || i === 1) node.textContent = suffix;
    });
    ctx.setLamp(state.cl as boolean);
  }

  function draw() {
    fit(screen);
    const u = unit();
    const { width: w, height: h } = screen;
    g.fillStyle = ctx.token('--screen-bg');
    g.fillRect(0, 0, w, h);
    const split = Math.round(h * 0.52);
    if (loop.name === 'heater') room(w, split);
    else if (loop.name === 'pendulum') cart(w, split);
    else spring(w, split);
    if (loop.failed) {
      g.fillStyle = ctx.token('--screen-alert');
      g.font = `${13 * u}px ${ctx.token('--f-mono')}`;
      g.textAlign = 'center';
      g.fillText('Fallen. Click here to restart.', w / 2, 20 * u);
    }
    plot(split + 6 * u, w, h);
    readouts();
  }

  ctx.onChange((key) => {
    if (internal) return;
    const plantChanged = state.p !== loop.name;
    if (key === 'p') {
      internal = true;
      ctx.set({ ...tunings[state.p as PlantName], s: state.p === 'spring' ? 0.8 : 0.5 });
      internal = false;
    }
    Object.assign(loop.settings, settings());
    if (plantChanged || key === null) restart();
    if (ctx.reduced && !plantChanged && key !== null) restart();
    draw();
  });
  ctx.onAction((key) => {
    if (key === 'knock') loop.knock();
    if (key === 'restart') restart();
    if (ctx.reduced && key === 'knock') for (let i = 0; i < 5 / DT; i++) tick();
    draw();
  });
  screen.addEventListener('click', () => {
    if (!loop.failed) return;
    restart();
    draw();
  });
  const resize = new ResizeObserver(draw);
  resize.observe(screen);
  restart();
  draw();
  const stop = runFrames(ctx.root, (elapsed) => {
    if (ctx.reduced || loop.failed) return;
    stepper.advance(elapsed);
    draw();
  });
  return () => {
    stop();
    resize.disconnect();
  };
};
