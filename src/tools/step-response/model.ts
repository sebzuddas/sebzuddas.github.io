import { abs, div, exp as cexp, fromRoots, polyval, roots, trim, type Complex } from '../../lib/instrument/signal';

export const MAX_ORDER = 8;
/** Coefficients run from the highest power of s down. The denominator is monic. */
export interface Transfer {
  num: number[];
  den: number[];
}
export type Parsed = { ok: true; system: Transfer } | { ok: false; reason: string };
export type Stability = 'Stable' | 'Marginal' | 'Unstable';

type Matrix = number[][];

function numbers(text: string): number[] | undefined {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  const values = parts.map(Number);
  return parts.length && values.every(Number.isFinite) ? values : undefined;
}

export function parse(numerator: string, denominator: string, gain: number): Parsed {
  const rawNum = numbers(numerator);
  const rawDen = numbers(denominator);
  if (!rawNum || !rawDen) return { ok: false, reason: 'Coefficients must be numbers' };
  const num = trim(rawNum);
  const den = trim(rawDen);
  if (!den.length) return { ok: false, reason: 'The denominator cannot be zero' };
  if (den.length - 1 > MAX_ORDER) return { ok: false, reason: `Order is limited to ${MAX_ORDER}` };
  if (num.length > den.length) return { ok: false, reason: 'More zeros than poles: this cannot be simulated' };
  return { ok: true, system: { num: (num.length ? num : [0]).map((c) => (c * gain) / den[0]), den: den.map((c) => c / den[0]) } };
}

export const poles = ({ den }: Transfer) => roots(den);
export const zeros = ({ num }: Transfer) => (trim(num).length > 1 ? roots(num) : []);

export function stability(list: Complex[]): Stability {
  if (list.some((p) => p.re > 1e-6)) return 'Unstable';
  return list.some((p) => p.re > -1e-6) ? 'Marginal' : 'Stable';
}

export function dcGain({ num, den }: Transfer): number | undefined {
  const base = den[den.length - 1];
  return base === 0 ? undefined : num[num.length - 1] / base;
}

const identity = (n: number): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

function times(a: Matrix, b: Matrix): Matrix {
  return a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
}

const apply = (a: Matrix, v: number[]) => a.map((row) => row.reduce((sum, value, i) => sum + value * v[i], 0));

/** Matrix exponential by scaling, a Taylor series, and squaring. */
export function expm(a: Matrix): Matrix {
  const norm = Math.max(...a.map((row) => row.reduce((sum, value) => sum + Math.abs(value), 0)));
  const squarings = Math.max(0, Math.ceil(Math.log2(norm / 0.5 || 1)));
  const scale = 2 ** -squarings;
  const scaled = a.map((row) => row.map((value) => value * scale));
  let term = identity(a.length);
  let sum = identity(a.length);
  for (let k = 1; k <= 18; k++) {
    term = times(term, scaled).map((row) => row.map((value) => value / k));
    sum = sum.map((row, i) => row.map((value, j) => value + term[i][j]));
  }
  for (let i = 0; i < squarings; i++) sum = times(sum, sum);
  return sum;
}

/** Controllable canonical form, with any direct path from input to output in d. */
function stateSpace({ num, den }: Transfer) {
  const n = den.length - 1;
  const padded = [...Array(den.length - num.length).fill(0), ...num] as number[];
  const d = padded[0];
  const c = padded.slice(1).map((value, i) => value - d * den[i + 1]).reverse();
  const a: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === n - 1 ? -den[n - j] : j === i + 1 ? 1 : 0)));
  return { a, c, d, n };
}

/** The exact change in state over one step of length h, with the input held. */
function hold(a: Matrix, n: number, h: number) {
  const augmented = a.map((row, i) => [...row, i === n - 1 ? 1 : 0].map((value) => value * h));
  augmented.push(Array(n + 1).fill(0));
  const whole = expm(augmented);
  return { phi: whole.slice(0, n).map((row) => row.slice(0, n)), gamma: whole.slice(0, n).map((row) => row[n]) };
}

export interface Trace {
  t: number[];
  y: number[];
  end: number;
}

/** Unit step response. Exact at each sample for any order and repeated poles. Stops early if the output runs away. */
export function simulate(system: Transfer, end: number, samples = 4000): Trace {
  const { a, c, d, n } = stateSpace(system);
  const t = [0];
  const y = [d];
  if (!n) return { t: [0, end], y: [d, d], end };
  const { phi, gamma } = hold(a, n, end / samples);
  let x: number[] = Array(n).fill(0);
  for (let i = 1; i <= samples; i++) {
    x = apply(phi, x).map((value, k) => value + gamma[k]);
    const output = c.reduce((sum, value, k) => sum + value * x[k], d);
    if (!Number.isFinite(output) || Math.abs(output) > 1e6) break;
    t.push((i / samples) * end);
    y.push(output);
  }
  return { t, y, end };
}

/** A time window that shows the slowest thing the system does. */
export function timeSpan(list: Complex[]): number {
  if (!list.length) return 1;
  const growth = Math.max(...list.map((p) => p.re));
  const decays = list.filter((p) => p.re < -1e-6).map((p) => -p.re);
  const swings = list.filter((p) => Math.abs(p.im) > 1e-6).map((p) => Math.abs(p.im));
  const span = growth > 1e-6 ? 6 / growth
    : growth > -1e-6 ? (swings.length ? (8 * Math.PI) / Math.min(...swings) : 10)
    : 8 / Math.min(...decays);
  return Math.min(1e4, Math.max(1e-3, span));
}

const between = (t: number[], y: number[], i: number, level: number) => t[i - 1] + ((level - y[i - 1]) / (y[i] - y[i - 1])) * (t[i] - t[i - 1]);

/** Numbers read from the response. Times are undefined when the output never gets there. */
export function metrics({ t, y }: Trace, final: number) {
  const scaled = y.map((value) => value / final);
  const first = (level: number) => {
    const i = scaled.findIndex((value) => value >= level);
    return i < 1 ? undefined : between(t, scaled, i, level);
  };
  const low = first(0.1);
  const high = first(0.9);
  const peak = Math.max(...scaled);
  const overshoot = Math.max(0, 100 * (peak - 1));
  let settle = 0;
  for (let i = scaled.length - 1; i > 0; i--) {
    if (Math.abs(scaled[i] - 1) > 0.02) {
      settle = between(t, scaled, i + 1 < scaled.length ? i + 1 : i, scaled[i] > 1 ? 1.02 : 0.98);
      break;
    }
  }
  return {
    overshoot,
    peakTime: overshoot > 1e-6 ? t[scaled.indexOf(peak)] : undefined,
    rise: low !== undefined && high !== undefined ? high - low : undefined,
    settle,
  };
}

export interface Discrete {
  poles: Complex[];
  zeros: Complex[];
  num: number[];
  den: number[];
}

/**
 * Zero-order-hold equivalent, which matches the continuous response exactly at
 * the samples. The numerator comes from the resolvent of the discrete state
 * matrix. Undefined if a pole has grown too far to represent over one period.
 */
export function discretise(system: Transfer, period: number): Discrete | undefined {
  const s = poles(system);
  if (s.some((p) => p.re * period > 15)) return undefined;
  const { a, c, d, n } = stateSpace(system);
  if (!n) return { poles: [], zeros: [], num: [d], den: [1] };
  const { phi, gamma } = hold(a, n, period);
  const z = s.map((p) => cexp({ re: p.re * period, im: p.im * period }));
  const den = fromRoots(z);
  let resolvent = identity(n);
  const num: number[] = Array(n + 1).fill(0);
  for (let k = 0; k < n; k++) {
    num[k + 1] = c.reduce((sum, value, i) => sum + value * apply(resolvent, gamma)[i], 0);
    resolvent = times(phi, resolvent).map((row, i) => row.map((value, j) => value + (i === j ? den[k + 1] : 0)));
  }
  const whole = num.map((value, i) => value + d * den[i]);
  const trimmed = trim(whole, 1e-10);
  return { poles: z, zeros: trimmed.length > 1 ? roots(trimmed) : [], num: trimmed, den };
}

/** log10 of the magnitude over a grid in the complex plane, clamped so poles and zeros stay on the plot. */
export function surface(num: number[], den: number[], xs: number[], ys: number[], limit = 1.5): number[][] {
  return ys.map((im) => xs.map((re) => {
    const z = { re, im };
    const size = abs(div(polyval(num, z), polyval(den, z)));
    if (Number.isNaN(size)) return limit;
    return Math.min(limit, Math.max(-limit, Math.log10(Math.max(size, 1e-9))));
  }));
}

/** One of each conjugate pair, so dragging one moves both. */
export function grouped(list: Complex[]): Complex[] {
  return list.filter((p) => p.im >= 0);
}

export function ungrouped(list: Complex[]): Complex[] {
  return list.flatMap((p) => (p.im ? [p, { re: p.re, im: -p.im }] : [p]));
}

/** Coefficients as a person would type them. */
export const coefficients = (list: number[]) => list.map((c) => Number(c.toPrecision(4))).join(' ');

/** Where each plot sits on a canvas of this size. */
export function regions(width: number, height: number, unit: number) {
  const gap = 10 * unit;
  const top = Math.round(height * 0.52);
  const side = (width - gap) / 2;
  return {
    time: { x: 0, y: 0, w: width, h: top },
    s: { x: 0, y: top + gap, w: side, h: height - top - gap },
    z: { x: side + gap, y: top + gap, w: side, h: height - top - gap },
  };
}
