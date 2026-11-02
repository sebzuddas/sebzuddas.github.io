import { design, gain, type Family, type Response, type Section } from '../../lib/instrument/filters';
import { createRng } from '../../lib/instrument/rng';
import { fft } from '../../lib/instrument/signal';

/** A square image. Each channel runs from 0 to 1, row by row. */
export interface Picture {
  size: number;
  channels: Float64Array[];
}

export interface Kernel {
  size: number;
  values: number[];
  /** Added to the result, so filters with negative output stay on screen. */
  bias: number;
  /** Combine horizontal and vertical versions into a gradient size. */
  magnitude: boolean;
}

export type KernelName = 'gaussian' | 'box' | 'sharpen' | 'sobel' | 'laplacian' | 'emboss' | 'custom';
export type Scene = 'card' | 'rings';

export const STRIPE = { x: 0.18, y: 0.09 };
const TABLE = 1024;

export const blank = (size: number) => new Float64Array(size * size);
export const luma = ({ channels }: Picture) => (channels.length === 1 ? channels[0] : channels[0].map((r, i) => 0.299 * r + 0.587 * channels[1][i] + 0.114 * channels[2][i]));

/** Drawn from code, so it has soft areas, hard edges and fine detail, and belongs to nobody. */
export function testCard(size: number): Picture {
  const r = blank(size);
  const g = blank(size);
  const b = blank(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = y * size + x;
      let colour = [0.16 + 0.2 * u, 0.3 + 0.35 * v, 0.46 + 0.25 * (1 - v)];
      const sun = Math.hypot(u - 0.3, v - 0.32);
      if (sun < 0.2) colour = [0.96, 0.72 + 0.1 * Math.cos(sun * 30), 0.25];
      if (v > 0.66 && v < 0.66 + 0.12 * (1 + Math.sin(u * 9))) colour = [0.13, 0.42, 0.33];
      if (v > 0.8) colour = [0.45 + 0.15 * u, 0.3, 0.2];
      if (u > 0.62 && u < 0.9 && v > 0.1 && v < 0.38) {
        const hit = (Math.floor(u * 40) + Math.floor(v * 40)) % 2 === 0;
        colour = hit ? [0.95, 0.95, 0.9] : [0.08, 0.08, 0.1];
      }
      if (u > 0.58 && u < 0.92 && v > 0.45 && v < 0.62) {
        const shade = 0.5 + 0.5 * Math.sin(2 * Math.PI * (u - 0.58) * (8 + 140 * (u - 0.58)));
        colour = [shade, shade, shade];
      }
      [r[i], g[i], b[i]] = colour;
    }
  }
  return { size, channels: [r, g, b] };
}

/** A zone plate: every frequency in every direction, so a filter's shape can be read directly. */
export function rings(size: number): Picture {
  const value = blank(size);
  const scale = Math.PI / (2 * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      value[y * size + x] = 0.5 + 0.5 * Math.cos(2 * scale * (dx * dx + dy * dy));
    }
  }
  return { size, channels: [value, value.slice(), value.slice()] };
}

export function grey(picture: Picture): Picture {
  const value = luma(picture);
  return { size: picture.size, channels: [value, value.slice(), value.slice()] };
}

/** Adds seeded noise and fixed diagonal stripes. */
export function degrade({ size, channels }: Picture, noise: number, stripes: number): Picture {
  return {
    size,
    channels: channels.map((channel, c) => {
      const rng = createRng(17 + c);
      return channel.map((value, i) => {
        const x = i % size;
        const y = Math.floor(i / size);
        const stripe = stripes * Math.sin(2 * Math.PI * (STRIPE.x * x + STRIPE.y * y));
        const a = 1 - rng();
        const b = rng();
        return value + stripe + noise * Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
      });
    }),
  };
}

function transform2(re: Float64Array, im: Float64Array, size: number, inverse: boolean) {
  const rowRe = new Float64Array(size);
  const rowIm = new Float64Array(size);
  const flip = inverse ? -1 : 1;
  const lines = (read: (line: number, i: number) => number, write: (line: number, i: number) => number) => {
    for (let line = 0; line < size; line++) {
      for (let i = 0; i < size; i++) {
        const at = read(line, i);
        rowRe[i] = re[at];
        rowIm[i] = flip * im[at];
      }
      fft(rowRe, rowIm);
      for (let i = 0; i < size; i++) {
        const at = write(line, i);
        re[at] = rowRe[i];
        im[at] = flip * rowIm[i];
      }
    }
  };
  const row = (line: number, i: number) => line * size + i;
  const column = (line: number, i: number) => i * size + line;
  lines(row, row);
  lines(column, column);
  if (inverse) {
    const total = size * size;
    for (let i = 0; i < total; i++) {
      re[i] /= total;
      im[i] /= total;
    }
  }
}

export function fft2(re: Float64Array, im: Float64Array, size: number) {
  transform2(re, im, size, false);
}

export function ifft2(re: Float64Array, im: Float64Array, size: number) {
  transform2(re, im, size, true);
}

/** Distance from the centre of the spectrum, in cycles per pixel. */
function radius(index: number, size: number) {
  const x = index % size;
  const y = Math.floor(index / size);
  const u = (x > size / 2 ? x - size : x) / size;
  const v = (y > size / 2 ? y - size : y) / size;
  return Math.hypot(u, v);
}

export type Shape = (r: number) => number;

export interface Settings {
  family: Family | 'ideal';
  response: Response;
  order: number;
  cutoff: number;
  width: number;
  ripple: number;
  stopband: number;
}

function ideal({ response, cutoff, width }: Settings): Shape {
  const inside = (r: number) => r >= cutoff - width / 2 && r <= cutoff + width / 2;
  switch (response) {
    case 'lowpass': return (r) => (r <= cutoff ? 1 : 0);
    case 'highpass': return (r) => (r <= cutoff ? 0 : 1);
    case 'bandpass': return (r) => (inside(r) ? 1 : 0);
    case 'bandstop': return (r) => (inside(r) ? 0 : 1);
  }
}

/** The gain of a one-dimensional design, spun round the centre of the spectrum. */
export function radial(settings: Settings): Shape {
  if (settings.family === 'ideal') return ideal(settings);
  const sections: Section[] = design({ ...settings, family: settings.family });
  const table = Float64Array.from({ length: TABLE + 1 }, (_, i) => gain(sections, (0.5 * i) / TABLE));
  return (r) => {
    const at = (Math.min(r, 0.5) / 0.5) * TABLE;
    const low = Math.min(TABLE - 1, Math.floor(at));
    return table[low] + (at - low) * (table[low + 1] - table[low]);
  };
}

export function applyShape(picture: Picture, shape: Shape, bias = 0): Picture {
  const { size } = picture;
  const im = blank(size);
  const gains = Float64Array.from({ length: size * size }, (_, i) => shape(radius(i, size)));
  const channels = picture.channels.map((channel) => {
    const re = channel.slice();
    im.fill(0);
    fft2(re, im, size);
    for (let i = 0; i < re.length; i++) {
      re[i] *= gains[i];
      im[i] *= gains[i];
    }
    ifft2(re, im, size);
    return bias ? re.map((value) => value + bias) : re;
  });
  return { size, channels };
}

export function kernelOf(name: KernelName, amount: number, custom: string): Kernel | undefined {
  const plain = (size: number, values: number[], bias = 0, magnitude = false): Kernel => ({ size, values, bias, magnitude });
  switch (name) {
    case 'gaussian': {
      const reach = Math.ceil(3 * amount);
      const size = 2 * reach + 1;
      const values = Array.from({ length: size * size }, (_, i) => {
        const x = (i % size) - reach;
        const y = Math.floor(i / size) - reach;
        return Math.exp(-(x * x + y * y) / (2 * amount * amount));
      });
      const sum = values.reduce((total, value) => total + value, 0);
      return plain(size, values.map((value) => value / sum));
    }
    case 'box': {
      const size = 2 * Math.round(amount) + 1;
      return plain(size, Array(size * size).fill(1 / (size * size)));
    }
    case 'sharpen': {
      const k = amount / 2;
      return plain(3, [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0]);
    }
    case 'sobel': return plain(3, [-1, 0, 1, -2, 0, 2, -1, 0, 1], 0, true);
    case 'laplacian': return plain(3, [0, 1, 0, 1, -4, 1, 0, 1, 0], 0.5);
    case 'emboss': return plain(3, [-2, -1, 0, -1, 0, 1, 0, 1, 2], 0.5);
    case 'custom': {
      const parts = custom.trim().split(/[\s,]+/).map(Number);
      return parts.length === 9 && parts.every(Number.isFinite) ? plain(3, parts) : undefined;
    }
  }
}

function slide(channel: Float64Array, size: number, kernel: number[], width: number): Float64Array {
  const reach = (width - 1) / 2;
  const out = blank(size);
  const clamp = (value: number) => Math.max(0, Math.min(size - 1, value));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = 0; k < kernel.length; k++) {
        const weight = kernel[k];
        if (weight === 0) continue;
        const dx = (k % width) - reach;
        const dy = Math.floor(k / width) - reach;
        sum += weight * channel[clamp(y - dy) * size + clamp(x - dx)];
      }
      out[y * size + x] = sum;
    }
  }
  return out;
}

export function applyKernel({ size, channels }: Picture, kernel: Kernel): Picture {
  const across = kernel.values;
  const down = across.map((_, i) => across[(i % kernel.size) * kernel.size + Math.floor(i / kernel.size)]);
  return {
    size,
    channels: channels.map((channel) => {
      const first = slide(channel, size, across, kernel.size);
      if (!kernel.magnitude) return kernel.bias ? first.map((value) => value + kernel.bias) : first;
      const second = slide(channel, size, down, kernel.size);
      return first.map((value, i) => Math.hypot(value, second[i]));
    }),
  };
}

/** What a kernel does to each frequency along the horizontal axis, for the gain plot. */
export function kernelShape({ size, values }: Kernel): Shape {
  const reach = (size - 1) / 2;
  return (r) => {
    let re = 0;
    let im = 0;
    values.forEach((weight, i) => {
      const dx = (i % size) - reach;
      re += weight * Math.cos(2 * Math.PI * r * dx);
      im += weight * Math.sin(2 * Math.PI * r * dx);
    });
    return Math.hypot(re, im);
  };
}

/** Log magnitude with zero frequency in the middle, from 0 to 1. */
export function spectrumOf(picture: Picture): Float64Array {
  const { size } = picture;
  const re = luma(picture).slice();
  const im = blank(size);
  fft2(re, im, size);
  const out = blank(size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const value = Math.log10(1 + Math.hypot(re[i], im[i]));
      out[((y + half) % size) * size + (x + half) % size] = value;
    }
  }
  const top = Math.log10(1 + size * size * 0.6);
  return out.map((value) => Math.min(1, value / top));
}

/** Peak signal-to-noise ratio against a reference, in dB. Higher is closer. */
export function psnr(reference: Picture, test: Picture): number {
  let sum = 0;
  let count = 0;
  reference.channels.forEach((channel, c) => channel.forEach((value, i) => {
    const difference = value - Math.max(0, Math.min(1, test.channels[c][i]));
    sum += difference * difference;
    count++;
  }));
  return sum === 0 ? Infinity : -10 * Math.log10(sum / count);
}
