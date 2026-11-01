import { Recorder } from '../../lib/instrument/recorder';
import { fit, runFrames, type Mount } from '../../lib/instrument/runtime';
import { Stepper } from '../../lib/instrument/stepper';
import { along, layoutFor, type Layout, type Skin } from './layout';
import { DT, hero, type CascadeModel } from './model';

/** Ticks run unrecorded so the start-up transient is off the chart. */
const SETTLE = 20 / DT;
const PREROLL = 30 / DT;
const SAMPLE_EVERY = 2;
const SKIN_MATERIAL = { neural: 'phosphor', transit: 'blueprint' } as const;

export const mount: Mount = (ctx) => {
  const { state, root, screen, recorder: strip, meta } = ctx;
  const g = screen.getContext('2d');
  if (!g) throw new Error('No 2D canvas');

  let model: CascadeModel;
  let layout: Layout;
  let wires: HTMLCanvasElement | null = null;
  const recorder = new Recorder(meta.channels!, 30 / DT / SAMPLE_EVERY);
  const stepper = new Stepper(DT, advance);

  function apply() {
    model.setpoint = state.a as number;
    model.drive = state.h as number;
    model.closed = state.l as boolean;
  }

  function advance() {
    model.step();
    if (model.tick % SAMPLE_EVERY === 0) recorder.push([model.activity, model.gain]);
  }

  /** Same permalink, same run: replay 30 s from the seed so the recorder is full. */
  function restart() {
    model = hero(state.x as number);
    apply();
    for (let i = 0; i < SETTLE; i++) model.step();
    recorder.clear();
    for (let i = 0; i < PREROLL; i++) advance();
    model.trackPulses = true;
    relayout();
  }

  function relayout() {
    const skin = state.s as Skin;
    root.dataset.material = SKIN_MATERIAL[skin];
    layout = layoutFor(skin, model.graph, model.cfg.seed);
    wires = null;
  }

  /** Wiring changes only with the skin or size, so it is drawn once. */
  function drawWires(w: number, h: number) {
    const layer = document.createElement('canvas');
    layer.width = w;
    layer.height = h;
    const c = layer.getContext('2d')!;
    const unit = w / 900;
    const transit = state.s === 'transit';
    c.fillStyle = ctx.token('--screen-bg');
    c.fillRect(0, 0, w, h);

    c.strokeStyle = ctx.token('--screen-faint');
    c.lineWidth = Math.max(1, unit * 0.8);
    c.beginPath();
    for (let i = 1; i < 10; i++) {
      c.moveTo((i / 10) * w, 0);
      c.lineTo((i / 10) * w, h);
    }
    for (let i = 1; i < 6; i++) {
      c.moveTo(0, (i / 6) * h);
      c.lineTo(w, (i / 6) * h);
    }
    c.globalAlpha = 0.45;
    c.stroke();
    c.globalAlpha = 1;

    c.strokeStyle = ctx.token('--screen-dim');
    c.lineWidth = Math.max(1, unit * (transit ? 1.5 : 0.9));
    c.lineJoin = 'round';
    c.globalAlpha = transit ? 0.8 : 0.6;
    const route = (long: boolean) => {
      c.beginPath();
      layout.paths.forEach((edges, from) => {
        edges.forEach((path, e) => {
          if (model.graph[from][e].long !== long) return;
          path.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)));
        });
      });
      c.stroke();
    };
    route(false);
    c.strokeStyle = ctx.token('--screen-ink');
    c.lineWidth = Math.max(1.5, unit * (transit ? 3 : 1.5));
    route(true);
    c.globalAlpha = 1;
    return layer;
  }

  function drawScreen() {
    if (fit(screen) || !wires) wires = drawWires(screen.width, screen.height);
    const { width: w, height: h } = screen;
    const unit = w / 900;
    const transit = state.s === 'transit';
    const accent = ctx.token('--screen-accent');
    const ink = ctx.token('--screen-ink');
    const dim = ctx.token('--screen-dim');
    const bg = ctx.token('--screen-bg');

    // Afterglow: last frame fades instead of clearing.
    g!.globalAlpha = ctx.reduced ? 1 : 0.34;
    g!.drawImage(wires, 0, 0);
    g!.globalAlpha = 1;

    const size = Math.max(2, unit * (transit ? 4.5 : 3.4));
    const now = model.tick + stepper.alpha;
    layout.nodes.forEach(([x, y], i) => {
      const phase = model.phase[i];
      g!.beginPath();
      g!.arc(x * w, y * h, phase === 1 ? size * 1.5 : size, 0, Math.PI * 2);
      if (phase === 1) {
        g!.fillStyle = accent;
        g!.globalAlpha = 0.22;
        g!.beginPath();
        g!.arc(x * w, y * h, size * 4, 0, Math.PI * 2);
        g!.fill();
        g!.globalAlpha = 1;
        g!.beginPath();
        g!.arc(x * w, y * h, size * 1.5, 0, Math.PI * 2);
        g!.fill();
      } else if (transit) {
        g!.fillStyle = bg;
        g!.fill();
        g!.strokeStyle = phase === 2 ? ink : dim;
        g!.lineWidth = Math.max(1, unit * 1.4);
        g!.stroke();
      } else {
        g!.fillStyle = phase === 2 ? ink : dim;
        g!.fill();
      }
    });

    g!.fillStyle = accent;
    for (const pulse of model.pulses) {
      const edges = model.graph[pulse.from];
      const index = edges.findIndex((e) => e.to === pulse.to);
      const t = (now - pulse.sent) / (pulse.arrives - pulse.sent);
      const [x, y] = along(layout.paths[pulse.from][index], t);
      g!.globalAlpha = 0.25;
      g!.beginPath();
      g!.arc(x * w, y * h, size * 1.9, 0, Math.PI * 2);
      g!.fill();
      g!.globalAlpha = 1;
      g!.beginPath();
      g!.arc(x * w, y * h, size * 0.7, 0, Math.PI * 2);
      g!.fill();
    }
  }

  function drawRecorder() {
    if (!strip) return;
    fit(strip);
    recorder.draw(strip, ctx.token, { channel: 0, value: state.a as number, width: 0.02 * 0.3 });
  }

  function showReadouts() {
    ctx.setReadout('A', model.activity.toFixed(3));
    ctx.setReadout('As', (state.a as number).toFixed(3));
    ctx.setReadout('g', model.gain.toFixed(2));
    ctx.setReadout('gc', '1.00');
    ctx.setReadout('n', `${model.activeCount}/${model.nodes}`);
    ctx.setReadout('t', (model.tick * DT).toFixed(1));
    ctx.setReadout('u', model.output.toFixed(2));
    ctx.setLamp(state.l as boolean);
  }

  function drawAll() {
    drawScreen();
    drawRecorder();
    showReadouts();
  }

  restart();

  ctx.onChange((key) => {
    apply();
    if (key === 's' || key === null) relayout();
    if (ctx.reduced) {
      restart();
      drawAll();
    }
  });
  ctx.onRetheme(() => (wires = null));

  const perturb = (node: number) => {
    model.perturb(node);
    if (ctx.reduced) drawAll();
  };
  ctx.onAction(() => perturb(((Math.random() * model.nodes) | 0)));
  screen.addEventListener('click', (event) => {
    const box = screen.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    let best = 0;
    let distance = Infinity;
    layout.nodes.forEach(([nx, ny], i) => {
      const d = (nx - x) ** 2 + (ny - y) ** 2;
      if (d < distance) {
        distance = d;
        best = i;
      }
    });
    perturb(best);
  });

  const resize = new ResizeObserver(() => {
    fit(screen);
    wires = null;
    if (ctx.reduced) drawAll();
  });
  resize.observe(screen);

  drawAll();
  if (ctx.reduced) return () => resize.disconnect();

  const stop = runFrames(root, (elapsed) => {
    stepper.advance(elapsed);
    drawAll();
  });
  return () => {
    stop();
    resize.disconnect();
  };
};
