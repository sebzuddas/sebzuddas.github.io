import type { ToolMeta } from '../types';

export const meta: ToolMeta = {
  slug: 'falcon-9',
  title: 'Land the Falcon 9',
  summary: 'Land it yourself in 3D, open loop. Fly with assistance. Or watch model predictive control do it.',
  kind: 'simulation',
  material: 'phosphor',
  order: 1,
  model: 'Model SZ-3 Landing rig',
  screenLabel: 'Wireframe rocket descending toward a landing pad',
  fallback: 'This instrument needs WebGL, which is not available here. The notes below describe what it shows.',
  params: [
    {
      key: 'm',
      label: 'Autopilot status',
      kind: 'choice',
      value: 'auto',
      options: [
        { value: 'auto', label: 'On' },
        { value: 'assist', label: 'Assisted' },
        { value: 'manual', label: 'Manual' },
      ],
    },
    { key: 'x', kind: 'hidden', value: 7 },
  ],
  readouts: [
    { key: 'st', label: 'Status', text: true },
    { key: 'alt', label: 'Altitude', unit: 'm' },
    { key: 'vz', label: 'Vertical', unit: 'm/s' },
    { key: 'vx', label: 'Lateral', unit: 'm/s' },
    { key: 'vy', label: 'Forward', unit: 'm/s' },
    { key: 'tilt', label: 'Tilt', unit: 'deg' },
    { key: 'thr', label: 'Throttle', unit: '%' },
    { key: 'fuel', label: 'Fuel', unit: '%' },
    { key: 't', label: 't', unit: 's' },
  ],
  channels: [
    { label: 'CH1 descent, 0 to 80 m/s', min: 0, max: 80 },
    { label: 'CH2 throttle, 0 to 100%', min: 0, max: 1 },
  ],
  actions: [{ key: 'fly', label: 'Launch' }],
  keypads: [
    {
      id: 'wasd',
      keys: [
        { slot: 'up', cap: 'W', codes: ['KeyW'], action: 'Throttle up' },
        { slot: 'left', cap: 'A', codes: ['KeyA'], action: 'Steer left' },
        { slot: 'down', cap: 'S', codes: ['KeyS'], action: 'Throttle down' },
        { slot: 'right', cap: 'D', codes: ['KeyD'], action: 'Steer right' },
      ],
    },
    {
      id: 'arrows',
      keys: [
        { slot: 'up', cap: '↑', codes: ['ArrowUp'], action: 'Steer away' },
        { slot: 'left', cap: '←', codes: ['ArrowLeft'], action: 'Steer left' },
        { slot: 'down', cap: '↓', codes: ['ArrowDown'], action: 'Steer back' },
        { slot: 'right', cap: '→', codes: ['ArrowRight'], action: 'Steer right' },
      ],
    },
  ],
  lamp: 'MPC engaged',
  tape: 'Touch down under 3 m/s',
  references: [
    { label: 'L. Blackmore, Autonomous Precision Landing of Space Rockets, The Bridge, 2016', url: 'https://www.nae.edu/File.aspx?id=168977' },
    { label: 'J. B. Rawlings, D. Q. Mayne and M. Diehl, Model Predictive Control: Theory, Computation, and Design' },
    { label: 'Rocket landing with MPC, the project behind this', url: '/projects/acs6116-rocket-landing-mpc/' },
  ],
};
