import { createRng } from '../../lib/instrument/rng';
import { gain, normalise, type Family, type Response, type Section } from '../../lib/instrument/filters';
import { fft } from '../../lib/instrument/signal';

export { orderOf, polesOf, zerosOf } from '../../lib/instrument/filters';

/** A low rate puts the audible band all the way round the Z plane, and lets aliasing be heard. */
export const RATE = 8000;
export const NYQUIST = RATE / 2;

export type Wave = 'sine' | 'square' | 'saw' | 'triangle' | 'noise';
export type Mix = 'add' | 'ring';
export type FilterKind = 'off' | 'biquad' | 'custom' | Family;

export interface Source {
  wave: Wave;
  frequency: number;
  level: number;
}

export interface Pair {
  radius: number;
  /** Angle round the unit circle, given as the frequency it stands for. */
  hz: number;
}

const cycle = (phase: number) => phase - Math.floor(phase);

/** One naive sample of a waveform. There is no band limiting: harmonics past Nyquist alias, on purpose. */
export function sample(wave: Exclude<Wave, 'noise'>, phase: number): number {
  const p = cycle(phase);
  switch (wave) {
    case 'sine': return Math.sin(2 * Math.PI * p);
    case 'square': return p < 0.5 ? 1 : -1;
    case 'saw': return 2 * p - 1;
    case 'triangle': return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
  }
}

function tone({ wave, frequency, level }: Source, seed: number): Float64Array {
  const rng = createRng(seed);
  return Float64Array.from({ length: RATE }, (_, i) => level * (wave === 'noise' ? 2 * rng() - 1 : sample(wave, (frequency * i) / RATE)));
}

/** One second of the two sources together. Whole-number frequencies repeat exactly, so it loops without a click. */
export function mixed(one: Source, two: Source, mix: Mix): Float64Array {
  const a = tone(one, 11);
  const b = tone(two, 23);
  return a.map((value, i) => (mix === 'ring' ? value * b[i] : (value + b[i]) / 2));
}

/** Filter designs from Robert Bristow-Johnson's Audio EQ Cookbook. */
export function biquad(kind: Response, cutoff: number, q: number): Section {
  const w = (2 * Math.PI * cutoff) / RATE;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b: [number, number, number] = {
    lowpass: [(1 - cos) / 2, 1 - cos, (1 - cos) / 2],
    highpass: [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2],
    bandpass: [alpha, 0, -alpha],
    bandstop: [1, -2 * cos, 1],
  }[kind] as [number, number, number];
  return { b: b.map((value) => value / a0) as Section['b'], a: [1, (-2 * cos) / a0, (1 - alpha) / a0] };
}

const quadratic = ({ radius, hz }: Pair): [number, number, number] => [1, -2 * radius * Math.cos((2 * Math.PI * hz) / RATE), radius * radius];

export const gainAt = (sections: Section[], hz: number) => gain(sections, hz / RATE);

/** Two sections from hand-placed pairs, scaled so the loudest frequency has a gain of 1. */
export function handmade(poles: [Pair, Pair], zeros: [Pair, Pair]): Section[] {
  return normalise([{ b: quadratic(zeros[0]), a: quadratic(poles[0]) }, { b: quadratic(zeros[1]), a: quadratic(poles[1]) }]);
}

/** Direct form II transposed. */
export function apply(sections: Section[], input: Float64Array): Float64Array {
  let output = input;
  for (const { b, a } of sections) {
    let z1 = 0;
    let z2 = 0;
    // Two passes, keeping the second, so the loop has settled and joins cleanly.
    const once = new Float64Array(output.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < output.length; i++) {
        const x = output[i];
        const y = b[0] * x + z1;
        z1 = b[1] * x - a[1] * y + z2;
        z2 = b[2] * x - a[2] * y;
        once[i] = y;
      }
    }
    output = once;
  }
  return output;
}

/** Where a frequency lands after sampling. */
export function alias(hz: number): number {
  const folded = hz % RATE;
  return Math.min(folded, RATE - folded);
}

export const SPECTRUM_SIZE = 2048;

/** Amplitude spectrum with a Hann window, scaled so a sine of height 1 reads 0 dB. */
export function spectrum(signal: Float64Array): Float64Array {
  const n = SPECTRUM_SIZE;
  const window = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  const re = Float64Array.from({ length: n }, (_, i) => signal[i] * window[i]);
  const im = new Float64Array(n);
  fft(re, im);
  const sum = window.reduce((total, value) => total + value, 0);
  return Float64Array.from({ length: n / 2 + 1 }, (_, i) => (20 * Math.log10(Math.max((2 * Math.hypot(re[i], im[i])) / sum, 1e-6))));
}

export const decibels = (gain: number) => 20 * Math.log10(Math.max(gain, 1e-6));
