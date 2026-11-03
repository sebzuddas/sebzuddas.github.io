import type { ParamDef, ToolMeta } from '../types';
import { NYQUIST } from './model';

const waves = [
  { value: 'sine', label: 'Sine' },
  { value: 'square', label: 'Square' },
  { value: 'saw', label: 'Saw' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'noise', label: 'Noise' },
];

function source(n: 1 | 2, wave: string, frequency: number, level: number): ParamDef[] {
  return [
    { key: `w${n}`, label: `Generator ${n}`, kind: 'choice', value: wave, options: waves },
    { key: `f${n}`, label: `Frequency ${n}`, kind: 'number', min: 50, max: 6000, step: 1, value: frequency, decimals: 0, unit: 'Hz' },
    { key: `l${n}`, label: `Level ${n}`, kind: 'number', min: 0, max: 1, step: 0.01, value: level, decimals: 2 },
  ];
}

function pair(key: string, label: string, radius: number, hz: number, reach: number): ParamDef[] {
  return [
    { key: `${key}r`, label: `${label} radius`, kind: 'number', min: 0, max: reach, step: 0.01, value: radius, decimals: 2 },
    { key: `${key}a`, label: `${label} angle`, kind: 'number', min: 0, max: NYQUIST, step: 10, value: hz, decimals: 0, unit: 'Hz' },
  ];
}

export const meta: ToolMeta = {
  slug: 'signal-processing',
  title: 'Signal processing',
  summary: 'A small synthesiser: two waveform generators into a classic filter, or one you build from poles and zeros. See it, and hear it.',
  kind: 'simulation',
  material: 'phosphor',
  order: 4,
  model: 'Model SZ-4 Signal bench',
  screenLabel: 'Waveform, spectrum, frequency response and Z plane',
  screenAspect: { wide: '1 / 1', narrow: '4 / 5' },
  fallback: 'This instrument needs a canvas to draw on. The readouts below still update.',
  clickable: true,
  toggle: { key: 'sound', label: 'Sound' },
  params: [
    ...source(1, 'saw', 220, 0.8),
    ...source(2, 'sine', 1500, 0.4),
    { key: 'm', label: 'Combine', kind: 'choice', value: 'add', options: [{ value: 'add', label: 'Add' }, { value: 'ring', label: 'Multiply' }] },
    {
      key: 't',
      label: 'Filter',
      kind: 'choice',
      value: 'butterworth',
      options: [
        { value: 'off', label: 'None' },
        { value: 'butterworth', label: 'Butterworth' },
        { value: 'chebyshev1', label: 'Chebyshev type I' },
        { value: 'chebyshev2', label: 'Chebyshev type II' },
        { value: 'elliptic', label: 'Elliptic' },
        { value: 'bessel', label: 'Bessel' },
        { value: 'linkwitz', label: 'Linkwitz-Riley' },
        { value: 'biquad', label: 'Resonant biquad' },
        { value: 'custom', label: 'Your poles and zeros' },
      ],
    },
    {
      key: 'r',
      label: 'Response',
      kind: 'choice',
      value: 'lowpass',
      options: [
        { value: 'lowpass', label: 'Low-pass' },
        { value: 'highpass', label: 'High-pass' },
        { value: 'bandpass', label: 'Band-pass' },
        { value: 'bandstop', label: 'Band-stop' },
      ],
    },
    { key: 'n', label: 'Order', kind: 'number', min: 1, max: 8, step: 1, value: 4, decimals: 0 },
    { key: 'c', label: 'Cutoff', kind: 'number', min: 50, max: 3900, step: 10, value: 800, decimals: 0, unit: 'Hz' },
    { key: 'b', label: 'Bandwidth', kind: 'number', min: 20, max: 2000, step: 10, value: 400, decimals: 0, unit: 'Hz' },
    { key: 'rp', label: 'Passband ripple', kind: 'number', min: 0.1, max: 6, step: 0.1, value: 1, decimals: 1, unit: 'dB' },
    { key: 'rs', label: 'Stopband depth', kind: 'number', min: 20, max: 80, step: 1, value: 40, decimals: 0, unit: 'dB' },
    { key: 'q', label: 'Resonance Q', kind: 'number', min: 0.3, max: 10, step: 0.1, value: 0.7, decimals: 1 },
    ...pair('p1', 'Pole pair 1', 0.9, 1000, 0.98),
    ...pair('p2', 'Pole pair 2', 0, 2000, 0.98),
    ...pair('z1', 'Zero pair 1', 1, 3000, 1.5),
    ...pair('z2', 'Zero pair 2', 0, 2000, 1.5),
  ],
  readouts: [
    { key: 'st', label: 'Sampling', text: true },
    { key: 'h1', label: 'Tone 1 lands at', unit: 'Hz' },
    { key: 'h2', label: 'Tone 2 lands at', unit: 'Hz' },
    { key: 'g1', label: 'Gain at tone 1', unit: 'dB' },
    { key: 'g2', label: 'Gain at tone 2', unit: 'dB' },
    { key: 'or', label: 'Filter order' },
  ],
  presets: [
    { label: 'Mellow', values: { w1: 'saw', f1: 220, l1: 0.8, l2: 0, m: 'add', t: 'butterworth', r: 'lowpass', n: 4, c: 800 } },
    { label: 'Brick wall', values: { w1: 'noise', l1: 0.8, l2: 0, m: 'add', t: 'elliptic', r: 'lowpass', n: 8, c: 1000, rp: 1, rs: 60 } },
    { label: 'Crossover', values: { w1: 'noise', l1: 0.8, l2: 0, m: 'add', t: 'linkwitz', r: 'lowpass', n: 4, c: 1000 } },
    { label: 'Wah', values: { w1: 'saw', f1: 110, l1: 1, l2: 0, m: 'add', t: 'biquad', r: 'bandpass', c: 900, q: 6 } },
    { label: 'Ring mod', values: { w1: 'sine', f1: 440, l1: 1, w2: 'sine', f2: 90, l2: 1, m: 'ring', t: 'off' } },
    { label: 'Aliased', values: { w1: 'sine', f1: 5000, l1: 0.8, l2: 0, m: 'add', t: 'off' } },
    { label: 'By hand', values: { w1: 'noise', l1: 0.8, l2: 0, m: 'add', t: 'custom', p1r: 0.95, p1a: 1000, p2r: 0, z1r: 1, z1a: 3000, z2r: 0 } },
  ],
  references: [
    { label: 'A. V. Oppenheim and R. W. Schafer, Discrete-Time Signal Processing' },
    { label: 'S. W. Smith, The Scientist and Engineer\'s Guide to Digital Signal Processing', url: 'https://www.dspguide.com/' },
    { label: 'R. Bristow-Johnson, Audio EQ Cookbook, for the resonant biquad', url: 'https://www.w3.org/TR/audio-eq-cookbook/' },
    { label: 'S. J. Orfanidis, Lecture Notes on Elliptic Filter Design, for the elliptic poles and zeros' },
  ],
};
