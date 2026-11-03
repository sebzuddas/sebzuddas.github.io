import { fit, type Mount } from '../../lib/instrument/runtime';
import type { Family, Response } from '../../lib/instrument/filters';
import {
  applyKernel, applyShape, blank, degrade, grey, kernelOf, kernelShape, psnr, radial, rings, spectrumOf, testCard,
  type KernelName, type Picture, type Shape,
} from './model';

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const EDGE = 12;

function toCanvas(canvas: HTMLCanvasElement, { size, channels }: Picture) {
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 3; c++) image.data[4 * i + c] = 255 * Math.max(0, Math.min(1, channels[c][i]));
    image.data[4 * i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

export const mount: Mount = (ctx) => {
  const { state, screen, root } = ctx;
  const drawing = screen.getContext('2d');
  if (!drawing) throw new Error('No 2D canvas');
  const g = drawing;
  const layers = { before: document.createElement('canvas'), after: document.createElement('canvas'), spectrumA: document.createElement('canvas'), spectrumB: document.createElement('canvas') };

  let bitmap: ImageBitmap | undefined;
  let shape: Shape | undefined;
  let scheduled = 0;

  const size = () => Number(state.sz);

  function source(): Picture {
    if (bitmap) {
      const n = size();
      const canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      // Crop to the middle square: the 2D transforms here work on squares.
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, n, n);
      const { data } = context.getImageData(0, 0, n, n);
      const channels = [blank(n), blank(n), blank(n)];
      for (let i = 0; i < n * n; i++) for (let c = 0; c < 3; c++) channels[c][i] = data[4 * i + c] / 255;
      return { size: n, channels };
    }
    return state.src === 'rings' ? rings(size()) : testCard(size());
  }

  function run() {
    const frequency = state.d === 'frequency';
    const family = state.t as Family | 'ideal';
    const response = state.r as Response;
    const banded = response === 'bandpass' || response === 'bandstop';
    const toggle = (key: string, hide: boolean) => root.querySelector(`[data-param="${key}"]`)?.closest('.control')?.toggleAttribute('hidden', hide);
    ['t', 'r', 'c'].forEach((key) => toggle(key, !frequency));
    toggle('n', !frequency || family === 'ideal');
    toggle('b', !frequency || !banded);
    toggle('rp', !frequency || (family !== 'chebyshev1' && family !== 'elliptic'));
    toggle('rs', !frequency || (family !== 'chebyshev2' && family !== 'elliptic'));
    toggle('k', frequency);
    const name = state.k as KernelName;
    toggle('s', frequency || !['gaussian', 'box', 'sharpen'].includes(name));
    toggle('cu', frequency || name !== 'custom');
    toggle('src', Boolean(bitmap));

    const start = state.col ? source() : grey(source());
    const before = degrade(start, state.nz as number, state.st as number);
    let after = before;
    const custom = root.querySelector(`[data-param="cu"]`);
    custom?.setAttribute('aria-invalid', 'false');
    if (frequency) {
      shape = radial({
        family, response, order: state.n as number, cutoff: state.c as number, width: state.b as number, ripple: state.rp as number, stopband: state.rs as number,
      });
      // A filter that removes the average needs lifting back onto the screen.
      after = applyShape(before, shape, response === 'highpass' || response === 'bandpass' ? 0.5 : 0);
    } else {
      const kernel = kernelOf(name, state.s as number, state.cu as string);
      shape = kernel && kernelShape(kernel);
      if (kernel) after = applyKernel(before, kernel);
      else custom?.setAttribute('aria-invalid', 'true');
    }
    toCanvas(layers.before, before);
    toCanvas(layers.after, after);
    const tint = (values: Float64Array, n: number): Picture => ({ size: n, channels: [values, values, values] });
    toCanvas(layers.spectrumA, tint(spectrumOf(before), before.size));
    toCanvas(layers.spectrumB, tint(spectrumOf(after), after.size));
    const quality = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : '--');
    ctx.setReadout('p0', quality(psnr(start, before)));
    ctx.setReadout('p1', quality(psnr(start, after)));
    ctx.setReadout('im', bitmap ? 'Yours' : 'Built-in');
    draw();
  }

  function schedule() {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(run);
  }

  function gainPlot(x: number, y: number, w: number, h: number) {
    const u = Math.min(devicePixelRatio || 1, 2);
    g.fillStyle = ctx.token('--screen-ink');
    g.font = `${10 * u}px ${ctx.token('--f-mono')}`;
    g.textAlign = 'left';
    g.fillText(w > 420 * u ? 'Filter gain against frequency, 0 to 0.5 cycles per pixel' : 'Filter gain, 0 to 0.5 cycles/px', x, y + 10 * u);
    if (!shape) return;
    const top = y + 16 * u;
    const bottom = y + h - 2 * u;
    const reach = Math.max(1, ...Array.from({ length: 41 }, (_, i) => shape!((0.5 * i) / 40)));
    g.strokeStyle = ctx.token('--screen-faint');
    g.lineWidth = u;
    g.beginPath();
    g.moveTo(x, bottom);
    g.lineTo(x + w, bottom);
    g.moveTo(x, top);
    g.lineTo(x + w, top);
    g.stroke();
    g.strokeStyle = ctx.token('--screen-accent');
    g.lineWidth = 2 * u;
    g.beginPath();
    for (let i = 0; i <= 200; i++) {
      const px = x + (i / 200) * w;
      const py = bottom - (shape((0.5 * i) / 200) / reach) * (bottom - top);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.stroke();
  }

  function draw() {
    fit(screen);
    const u = Math.min(devicePixelRatio || 1, 2);
    const { width: w, height: h } = screen;
    g.fillStyle = ctx.token('--screen-bg');
    g.fillRect(0, 0, w, h);
    const edge = EDGE * u;
    const strip = 58 * u;
    const gap = 8 * u;
    const label = 14 * u;
    const cell = Math.min((w - 2 * edge - gap) / 2, (h - 2 * edge - strip - 2 * gap - 2 * label) / 2);
    const left = (w - 2 * cell - gap) / 2;
    const place = (layer: HTMLCanvasElement, text: string, column: number, row: number) => {
      const x = left + column * (cell + gap);
      const y = edge + row * (cell + label + gap);
      g.fillStyle = ctx.token('--screen-ink');
      g.font = `${11 * u}px ${ctx.token('--f-mono')}`;
      g.textAlign = 'left';
      g.fillText(text, x, y + 10 * u);
      if (layer.width) g.drawImage(layer, x, y + label, cell, cell);
    };
    place(layers.before, 'Before', 0, 0);
    place(layers.after, 'After', 1, 0);
    place(layers.spectrumA, 'Spectrum before', 0, 1);
    place(layers.spectrumB, 'Spectrum after', 1, 1);
    gainPlot(left, h - edge - strip, 2 * cell + gap, strip);
  }

  async function take(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_FILE_BYTES) {
      ctx.setReadout('im', 'Not an image');
      return;
    }
    try {
      bitmap = await createImageBitmap(file);
      run();
    } catch {
      ctx.setReadout('im', 'Not an image');
    }
  }

  const input = root.querySelector<HTMLInputElement>('[data-upload]');
  input?.addEventListener('change', () => take(input.files?.[0]));
  screen.addEventListener('dragover', (event) => event.preventDefault());
  screen.addEventListener('drop', (event) => {
    event.preventDefault();
    take(event.dataTransfer?.files[0]);
  });

  ctx.onChange(schedule);
  ctx.onAction((key) => {
    if (key !== 'clear') return;
    bitmap = undefined;
    if (input) input.value = '';
    run();
  });
  const resize = new ResizeObserver(draw);
  resize.observe(screen);
  run();
  return () => {
    cancelAnimationFrame(scheduled);
    resize.disconnect();
  };
};
