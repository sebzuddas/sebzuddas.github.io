import type { ParamDef, ToolMeta } from '../types';
import { MAX_LENGTH } from './formula';
import { SPAN } from './model';

const shapes = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'tri', label: 'Triangle' },
  { value: 'exp', label: 'Exponential decay' },
  { value: 'gauss', label: 'Gaussian' },
  { value: 'step', label: 'Step' },
  { value: 'impulse', label: 'Impulse' },
  { value: 'burst', label: 'Sine burst' },
  { value: 'formula', label: 'Your formula' },
];

function controls(key: 'f' | 'g', shape: string, width: number, formula: string): ParamDef[] {
  return [
    { key: `${key}s`, label: `${key}(t) shape`, kind: 'choice', value: shape, options: shapes },
    { key: `${key}f`, label: `${key}(t) formula, in t`, kind: 'text', value: formula, maxLength: MAX_LENGTH, placeholder: formula },
    { key: `${key}w`, label: `${key}(t) width`, kind: 'number', min: 0.2, max: 4, step: 0.1, value: width, decimals: 1, unit: 's' },
    { key: `${key}a`, label: `${key}(t) height`, kind: 'number', min: 0.1, max: 2, step: 0.1, value: 1, decimals: 1 },
  ];
}

export const meta: ToolMeta = {
  slug: 'convolution',
  title: 'Convolution',
  summary: 'Define two functions and watch one slide across the other. The area they share at each moment draws the result.',
  kind: 'simulation',
  material: 'blueprint',
  order: 3,
  model: 'Model SZ-1 Convolution bench',
  screenLabel: 'Two functions sliding past each other above the output they produce',
  screenAspect: { wide: '16 / 11', narrow: '4 / 5' },
  fallback: 'This instrument needs a canvas to draw on. The readouts below still update.',
  clickable: true,
  params: [
    ...controls('f', 'rect', 2, 'exp(-t)*sin(5*t)*step(t)'),
    ...controls('g', 'exp', 1, 'rect(t)'),
    { key: 'p', label: 'Position t', kind: 'number', min: -SPAN, max: SPAN, step: 0.02, value: SPAN, decimals: 2, unit: 's' },
  ],
  readouts: [
    { key: 'y', label: 'Output y(t)' },
    { key: 'pk', label: 'Peak of y' },
    { key: 'af', label: 'Area of f' },
    { key: 'ag', label: 'Area of g' },
    { key: 'ay', label: 'Area of y' },
  ],
  actions: [{ key: 'play', label: 'Play or pause' }],
  presets: [
    { label: 'Box and box', values: { fs: 'rect', fw: 2, fa: 1, gs: 'rect', gw: 2, ga: 1 } },
    { label: 'RC filter', values: { fs: 'rect', fw: 2, fa: 1, gs: 'exp', gw: 1, ga: 1 } },
    { label: 'Blur a step', values: { fs: 'step', fw: 2, fa: 1, gs: 'gauss', gw: 0.5, ga: 1 } },
    { label: 'Impulse', values: { fs: 'tri', fw: 2, fa: 1, gs: 'impulse', gw: 1, ga: 1 } },
    { label: 'Ringing', values: { fs: 'rect', fw: 1, fa: 1, gs: 'burst', gw: 2, ga: 1 } },
  ],
  references: [
    { label: 'A. V. Oppenheim and A. S. Willsky, Signals and Systems, chapters on linear time-invariant systems' },
    { label: 'R. N. Bracewell, The Fourier Transform and Its Applications' },
  ],
};
