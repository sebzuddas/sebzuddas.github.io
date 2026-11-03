import type { ToolMeta } from '../types';
import { tunings } from './model';

export const meta: ToolMeta = {
  slug: 'pid',
  title: 'PID control',
  summary: 'Tune the most common controller in engineering. Hold a room at temperature, place a mass on a spring, and balance a pole on a moving cart.',
  kind: 'simulation',
  material: 'plotter',
  order: 6,
  model: 'Model SZ-6 Control bench',
  screenLabel: 'An animated system above a plot of its target, measurement and control output',
  screenAspect: { wide: '16 / 11', narrow: '4 / 5' },
  fallback: 'This instrument needs a canvas to draw on. The readouts below still update.',
  lamp: 'Loop closed',
  clickable: true,
  params: [
    {
      key: 'p',
      label: 'System',
      kind: 'choice',
      value: 'pendulum',
      options: [
        { value: 'pendulum', label: 'Inverted pendulum' },
        { value: 'heater', label: 'Room heater' },
        { value: 'spring', label: 'Mass on a spring' },
      ],
    },
    { key: 's', label: 'Target', kind: 'number', min: 0, max: 1, step: 0.01, value: 0.5, decimals: 2 },
    { key: 'kp', label: 'Proportional Kp', kind: 'number', min: 0, max: 150, step: 0.5, value: tunings.pendulum.kp, decimals: 1 },
    { key: 'ki', label: 'Integral Ki', kind: 'number', min: 0, max: 30, step: 0.1, value: tunings.pendulum.ki, decimals: 1 },
    { key: 'kd', label: 'Derivative Kd', kind: 'number', min: 0, max: 30, step: 0.1, value: tunings.pendulum.kd, decimals: 1 },
    { key: 'cl', label: 'Loop closed', kind: 'switch', value: true },
    { key: 'aw', label: 'Anti-windup', kind: 'switch', value: true },
  ],
  readouts: [
    { key: 'st', label: 'Status', text: true },
    { key: 'y', label: 'Measured' },
    { key: 'r', label: 'Target' },
    { key: 'u', label: 'Output', unit: '%' },
    { key: 't', label: 'Time', unit: 's' },
  ],
  actions: [
    { key: 'knock', label: 'Knock it' },
    { key: 'restart', label: 'Restart' },
  ],
  presets: [
    { label: 'Pendulum', values: { p: 'pendulum', s: 0.5, ...tunings.pendulum } },
    { label: 'Heater', values: { p: 'heater', s: 0.5, ...tunings.heater } },
    { label: 'Spring', values: { p: 'spring', s: 0.8, ...tunings.spring } },
  ],
  references: [
    { label: 'K. J. Åström and T. Hägglund, Advanced PID Control' },
    { label: 'K. J. Åström and R. M. Murray, Feedback Systems', url: 'https://fbswiki.org/' },
    { label: 'J. G. Ziegler and N. B. Nichols, Optimum settings for automatic controllers, 1942' },
  ],
};
