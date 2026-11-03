import type { ToolMeta } from '../types';

export const meta: ToolMeta = {
  slug: 'step-response',
  title: 'Step response',
  summary: 'Define a transfer function of any order up to 8, watch it answer a step, and see its poles and zeros in the S and Z planes.',
  kind: 'simulation',
  material: 'plotter',
  order: 2,
  model: 'Model SZ-2 Step plotter',
  screenLabel: 'Unit step response above the S plane and Z plane pole-zero maps',
  screenAspect: { wide: '16 / 11', narrow: '4 / 5' },
  fallback: 'This instrument needs a canvas to plot on. The readouts below still update.',
  clickable: true,
  params: [
    { key: 'num', label: 'Numerator: its roots are the zeros', kind: 'text', value: '4', maxLength: 80, placeholder: '4' },
    { key: 'den', label: 'Denominator: its roots are the poles', kind: 'text', value: '1 0.8 4', maxLength: 80, placeholder: '1 0.8 4' },
    { key: 'k', label: 'Gain K', kind: 'number', min: 0.1, max: 10, step: 0.1, value: 1, decimals: 1 },
    { key: 'T', label: 'Sample period T', kind: 'number', min: 0.01, max: 2, step: 0.01, value: 0.2, decimals: 2, unit: 's' },
    { key: 'v', label: '3D magnitude surface', kind: 'switch', value: false },
  ],
  readouts: [
    { key: 'st', label: 'Stability', text: true },
    { key: 'fv', label: 'Final value' },
    { key: 'os', label: 'Overshoot', unit: '%' },
    { key: 'tp', label: 'Peak time', unit: 's' },
    { key: 'tr', label: 'Rise time 10 to 90%', unit: 's' },
    { key: 'ts', label: 'Settling time 2%', unit: 's' },
  ],
  actions: [{ key: 'replay', label: 'Replay' }],
  presets: [
    { label: 'First order', values: { num: '1', den: '1 1' } },
    { label: 'Underdamped', values: { num: '4', den: '1 0.8 4' } },
    { label: 'Critical', values: { num: '4', den: '1 4 4' } },
    { label: 'Third order', values: { num: '6', den: '1 6 11 6' } },
    { label: 'RHP zero', values: { num: '-1 1', den: '1 2 1' } },
    { label: 'Unstable', values: { num: '1', den: '1 -0.2 1' } },
    { label: 'Butterworth', values: { num: '1', den: '1 2.613 3.414 2.613 1' } },
  ],
  references: [
    { label: 'K. Ogata, Modern Control Engineering, chapters on transient response and root locus' },
    { label: 'G. F. Franklin, J. D. Powell and M. Workman, Digital Control of Dynamic Systems, on the zero-order-hold equivalent' },
  ],
};
