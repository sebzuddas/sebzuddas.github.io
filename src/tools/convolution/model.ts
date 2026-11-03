import { parseFormula } from './formula';

/** Half the width of the plotted window, in seconds. */
export const SPAN = 6;
export const DT = 0.02;
const COUNT = Math.round((2 * SPAN) / DT) + 1;

export type Shape = 'rect' | 'tri' | 'exp' | 'gauss' | 'step' | 'impulse' | 'burst' | 'formula';

export interface Definition {
  shape: Shape;
  width: number;
  height: number;
  formula: string;
}

export interface Signal {
  /** Value at each index: the time is index * DT, from -2 SPAN to 2 SPAN so that a flipped copy can slide across the window. */
  at(t: number): number;
  error?: string;
  /** An impulse is a spike of area `height`, so plots scale to the height, not the spike. */
  peak: number;
}

const index = (t: number) => Math.round(t / DT);

function shapeFn({ shape, width: w, height: a }: Definition): (t: number) => number {
  switch (shape) {
    // Half open, so a rectangle covers exactly its width on the grid.
    case 'rect': return (t) => (t >= -w / 2 - 1e-9 && t < w / 2 - 1e-9 ? a : 0);
    case 'tri': return (t) => a * Math.max(0, 1 - Math.abs(t) / w);
    case 'exp': return (t) => (t >= 0 ? a * Math.exp(-t / w) : 0);
    case 'gauss': return (t) => a * Math.exp(-(t * t) / (2 * w * w));
    case 'step': return (t) => (t >= 0 ? a : 0);
    case 'burst': return (t) => (t >= 0 && t <= w ? a * Math.sin((6 * Math.PI * t) / w) : 0);
    default: return () => 0;
  }
}

export function signal(definition: Definition): Signal {
  if (definition.shape === 'impulse') {
    return { at: (t) => (index(t) === 0 ? definition.height / DT : 0), peak: Math.abs(definition.height) };
  }
  let fn = shapeFn(definition);
  let error: string | undefined;
  if (definition.shape === 'formula') {
    const parsed = parseFormula(definition.formula);
    error = parsed.ok ? undefined : parsed.reason;
    const inner = parsed.ok ? parsed.fn : () => 0;
    fn = (t) => (Math.abs(t) <= SPAN ? inner(t) : 0);
  }
  let peak = 0;
  for (let i = 0; i < COUNT; i++) peak = Math.max(peak, Math.abs(fn(-SPAN + i * DT)));
  return { at: fn, error, peak: peak || 1 };
}

const times = Array.from({ length: COUNT }, (_, i) => -SPAN + i * DT);

export interface Result {
  t: number[];
  y: number[];
  areaF: number;
  areaG: number;
  peak: number;
}

/** y(t) = ∫ f(τ) g(t - τ) dτ on the window, as a Riemann sum. Both functions count as zero where the window ends. */
export function convolve(f: Signal, g: Signal): Result {
  const fValues = times.map(f.at);
  const gValues = Array.from({ length: 2 * COUNT - 1 }, (_, i) => g.at((i - (COUNT - 1)) * DT));
  const y = times.map((_, i) => {
    let sum = 0;
    for (let j = 0; j < COUNT; j++) {
      if (fValues[j] !== 0) sum += fValues[j] * gValues[i - j + COUNT - 1];
    }
    return sum * DT;
  });
  const area = (s: Signal) => times.reduce((sum, t) => sum + s.at(t), 0) * DT;
  return { t: times, y, areaF: area(f), areaG: area(g), peak: Math.max(...y.map(Math.abs)) || 1 };
}

/** The integrand at one sliding position: what is shaded on the plot. */
export function overlap(f: Signal, g: Signal, position: number, tau: number): number {
  return f.at(tau) * g.at(position - tau);
}

export function outputAt({ y }: Result, position: number): number {
  const i = Math.round((position + SPAN) / DT);
  return y[Math.max(0, Math.min(y.length - 1, i))];
}
