import type { ToolMeta } from '../types';

export const meta: ToolMeta = {
  slug: 'cascade',
  title: 'Cascades under feedback',
  summary: 'One network, drawn as a nervous system or a city. Hold it near the edge of runaway, then open the loop.',
  kind: 'simulation',
  material: 'phosphor',
  order: 3,
  model: 'Model SZ-1 Cascade rig',
  screenLabel: '160 node cascade network',
  fallback: 'This instrument needs a canvas to draw on. The notes below describe what it shows.',
  params: [
    { key: 'a', label: 'Setpoint A*', kind: 'number', min: 0.04, max: 0.16, step: 0.01, value: 0.1, decimals: 2 },
    { key: 'l', label: 'Loop closed', kind: 'switch', value: true },
    { key: 'h', label: 'Drive h', kind: 'number', min: 0.01, max: 0.2, step: 0.01, value: 0.05, decimals: 2, unit: '/s' },
    {
      key: 's',
      label: 'System',
      kind: 'choice',
      value: 'neural',
      options: [
        { value: 'neural', label: 'Nervous system' },
        { value: 'transit', label: 'City transport' },
      ],
    },
    { key: 'x', kind: 'hidden', value: 7 },
  ],
  readouts: [
    { key: 'A', label: 'A', unit: 'of 1' },
    { key: 'As', label: 'A*', unit: 'of 1' },
    { key: 'g', label: 'σ', unit: 'dimensionless' },
    { key: 'gc', label: 'σc', unit: 'dimensionless' },
    { key: 'n', label: 'Active', unit: 'nodes' },
    { key: 't', label: 't', unit: 's' },
    { key: 'u', label: 'u', unit: 'dimensionless' },
  ],
  channels: [
    { label: 'CH1 A, 0 to 0.3', min: 0, max: 0.3 },
    { label: 'CH2 σ, 0 to 2', min: 0, max: 2 },
  ],
  presets: [
    { label: 'Quiet', values: { a: 0.05, h: 0.02 } },
    { label: 'Nominal', values: { a: 0.1, h: 0.05 } },
    { label: 'Busy', values: { a: 0.14, h: 0.1 } },
  ],
  actions: [{ key: 'perturb', label: 'Perturb' }],
  lamp: 'Loop closed',
  clickable: true,
  tape: 'A* 0.10 nominal',
  references: [
    { label: 'T. E. Harris, The Theory of Branching Processes, 1963' },
    { label: 'J. M. Beggs and D. Plenz, Neuronal avalanches in neocortical circuits, J. Neurosci., 2003' },
  ],
};
