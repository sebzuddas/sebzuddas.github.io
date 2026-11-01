import type { ToolMeta } from '../types';

export const meta: ToolMeta = {
  slug: 'step-response',
  title: 'Second-order step response',
  summary: 'Set the damping ratio and natural frequency. Read off overshoot, peak time, rise time and settling time.',
  kind: 'calculator',
  material: 'plotter',
  order: 2,
  model: 'Model SZ-2 Step plotter',
  screenLabel: 'Unit step response plot',
  fallback: 'This calculator needs a canvas to plot on. The readouts below still update.',
  params: [
    { key: 'z', label: 'Damping ratio ζ', kind: 'number', min: 0.05, max: 2, step: 0.01, value: 0.5, decimals: 2 },
    { key: 'w', label: 'Natural frequency ωn', kind: 'number', min: 0.1, max: 20, step: 0.1, value: 2, decimals: 1, unit: 'rad/s' },
  ],
  readouts: [
    { key: 'os', label: 'Overshoot', unit: '%' },
    { key: 'tp', label: 'Peak time', unit: 's' },
    { key: 'tr', label: 'Rise time 10 to 90%', unit: 's' },
    { key: 'ts', label: 'Settling time 2%', unit: 's' },
  ],
  presets: [
    { label: 'Light', values: { z: 0.2, w: 2 } },
    { label: 'ζ = 0.71', values: { z: 0.71, w: 2 } },
    { label: 'Critical', values: { z: 1, w: 2 } },
  ],
  references: [{ label: 'K. Ogata, Modern Control Engineering, chapter on transient response' }],
};
