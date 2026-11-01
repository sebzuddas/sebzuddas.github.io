import { createRng, poisson } from '../../lib/instrument/rng';

/** Simulation step in seconds. Everything in the model counts in these ticks. */
export const DT = 0.05;

export const COLS = 16;
export const ROWS = 10;
export const NODES = COLS * ROWS;

export interface ModelConfig {
  seed: number;
  nodes?: number;
  /** Out-degree of every node. */
  k: number;
  /** Ticks a node stays active after firing. */
  activeTicks: number;
  /** Further ticks it cannot fire again. */
  refractoryTicks: number;
  /** Nominal gain. */
  sigma0: number;
  /** Disturbance amplitude and period (s) on the gain. */
  disturbance: number;
  period: number;
  kp: number;
  ki: number;
  /** Time constant (s) of the smoothed activity A. */
  smoothing: number;
}

export const DEFAULTS: Omit<ModelConfig, 'seed'> = {
  k: 4,
  activeTicks: 3,
  refractoryTicks: 6,
  sigma0: 1.1,
  disturbance: 0.6,
  period: 16,
  kp: 8,
  ki: 12,
  smoothing: 0.8,
};

export interface Edge {
  to: number;
  /** Ticks for a pulse to cross this edge. */
  delay: number;
  /** True for a long-range link. */
  long: boolean;
}

export type Graph = Edge[][];

/**
 * A 16 x 10 lattice where each node links to neighbours in the eight compass
 * directions, plus a few long-range links. Both skins draw this same graph.
 */
export function latticeGraph(seed: number, k: number, longRange = 0.08): Graph {
  const rand = createRng(seed ^ 0x9e3779b9);
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const graph: Graph = [];
  for (let i = 0; i < NODES; i++) {
    const x = i % COLS;
    const y = (i / COLS) | 0;
    const near: number[] = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) near.push(ny * COLS + nx);
    }
    for (let j = near.length - 1; j > 0; j--) {
      const r = (rand() * (j + 1)) | 0;
      [near[j], near[r]] = [near[r], near[j]];
    }
    const edges: Edge[] = [];
    for (let e = 0; e < k; e++) {
      if (rand() < longRange) {
        let to = (rand() * NODES) | 0;
        while (to === i) to = (rand() * NODES) | 0;
        edges.push({ to, delay: 6, long: true });
      } else {
        edges.push({ to: near[e % near.length], delay: 3, long: false });
      }
    }
    graph.push(edges);
  }
  return graph;
}

/** A sparse random graph, locally tree-like at large N. */
export function randomGraph(seed: number, nodes: number, k: number): Graph {
  const rand = createRng(seed ^ 0x51ed270b);
  const graph: Graph = new Array(nodes);
  for (let i = 0; i < nodes; i++) {
    const edges: Edge[] = new Array(k);
    for (let e = 0; e < k; e++) edges[e] = { to: (rand() * nodes) | 0, delay: 1, long: false };
    graph[i] = edges;
  }
  return graph;
}

export interface Pulse {
  from: number;
  to: number;
  sent: number;
  arrives: number;
}

const REST = 0;
const ACTIVE = 1;
const REFRACTORY = 2;

export class CascadeModel {
  readonly cfg: ModelConfig;
  readonly graph: Graph;
  readonly nodes: number;
  /** 0 rest, 1 active, 2 refractory. */
  readonly phase: Uint8Array;
  /** Pulses in flight, for drawing. Empty unless trackPulses is set. */
  pulses: Pulse[] = [];
  trackPulses = false;

  tick = 0;
  /** Setpoint and drive, set by the controls. */
  setpoint = 0.1;
  drive = 0.05;
  closed = true;
  /** When set, the gain is held here and the controller and disturbance are off. */
  fixedGain: number | null = null;

  activity = 0;
  gain = 1;
  output = 0;
  activeCount = 0;
  /** Total firings since the last reset of this counter. */
  fired = 0;

  private integral = 0;
  private rand: () => number;
  private arrivals: number[][];
  private sources: number[][];
  private wake: number[][];
  private ringSize: number;

  constructor(cfg: ModelConfig, graph: Graph) {
    this.cfg = cfg;
    this.graph = graph;
    this.nodes = graph.length;
    this.phase = new Uint8Array(this.nodes);
    this.rand = createRng(cfg.seed);
    this.ringSize = 8 + cfg.activeTicks + cfg.refractoryTicks;
    this.arrivals = Array.from({ length: this.ringSize }, () => []);
    this.sources = Array.from({ length: this.ringSize }, () => []);
    this.wake = Array.from({ length: this.ringSize }, () => []);
  }

  private fire(node: number) {
    const { cfg, phase, tick, ringSize, rand } = this;
    phase[node] = ACTIVE;
    this.activeCount++;
    this.fired++;
    this.wake[(tick + cfg.activeTicks) % ringSize].push(node);
    const edges = this.graph[node];
    const p = this.gain / edges.length;
    for (let e = 0; e < edges.length; e++) {
      if (rand() < p) {
        const { to, delay } = edges[e];
        const slot = (tick + delay) % ringSize;
        this.arrivals[slot].push(to);
        this.sources[slot].push(node);
        if (this.trackPulses) this.pulses.push({ from: node, to, sent: tick, arrives: tick + delay });
      }
    }
  }

  /** Starts a cascade from a node. Ignored if the node is not at rest. */
  ignite(node: number) {
    if (this.phase[node] === REST) this.fire(node);
  }

  /** Starts a burst of cascades around a node. */
  perturb(node: number) {
    this.ignite(node);
    for (const edge of this.graph[node]) this.ignite(edge.to);
  }

  disturbance(t = this.tick * DT): number {
    return this.cfg.disturbance * Math.sin((2 * Math.PI * t) / this.cfg.period);
  }

  step() {
    const { cfg, phase, ringSize } = this;
    const slot = this.tick % ringSize;

    const waking = this.wake[slot];
    for (let i = 0; i < waking.length; i++) {
      const n = waking[i];
      if (phase[n] === ACTIVE) {
        phase[n] = REFRACTORY;
        this.activeCount--;
        this.wake[(this.tick + cfg.refractoryTicks) % ringSize].push(n);
      } else {
        phase[n] = REST;
      }
    }
    waking.length = 0;

    if (this.fixedGain !== null) {
      this.gain = this.fixedGain;
    } else {
      this.gain = Math.max(0, cfg.sigma0 + this.disturbance() + this.output);
    }

    const arriving = this.arrivals[slot];
    for (let i = 0; i < arriving.length; i++) {
      if (phase[arriving[i]] === REST) this.fire(arriving[i]);
    }
    arriving.length = 0;
    this.sources[slot].length = 0;

    if (this.fixedGain === null && this.drive > 0) {
      const count = poisson(this.drive * this.nodes * DT, this.rand);
      for (let i = 0; i < count; i++) {
        const n = (this.rand() * this.nodes) | 0;
        if (phase[n] === REST) this.fire(n);
      }
    }

    if (this.trackPulses && this.pulses.length) {
      const now = this.tick;
      this.pulses = this.pulses.filter((p) => p.arrives > now);
    }

    const alpha = DT / cfg.smoothing;
    this.activity += alpha * (this.activeCount / this.nodes - this.activity);

    if (this.closed) {
      const error = this.setpoint - this.activity;
      const proposed = this.integral + cfg.ki * error * DT;
      const raw = cfg.kp * error + proposed;
      this.output = Math.max(-1, Math.min(1, raw));
      if (raw === this.output) this.integral = proposed;
    } else {
      this.output = 0;
      this.integral = 0;
    }

    this.tick++;
  }

  /** True when no firing, pulse or refractory recovery is pending. */
  idle(): boolean {
    if (this.activeCount > 0) return false;
    return this.arrivals.every((a) => a.length === 0);
  }
}

export function hero(seed: number, overrides: Partial<ModelConfig> = {}): CascadeModel {
  const cfg = { ...DEFAULTS, seed, ...overrides };
  return new CascadeModel(cfg, latticeGraph(seed, cfg.k));
}

/** Mean total cascade size at a fixed gain, on a large sparse graph. */
export function meanCascadeSize(sigma: number, cascades: number, nodes: number, seed: number): number {
  const cfg: ModelConfig = {
    ...DEFAULTS,
    seed,
    k: 4,
    activeTicks: 1,
    refractoryTicks: 1,
  };
  const model = new CascadeModel(cfg, randomGraph(seed, nodes, cfg.k));
  model.closed = false;
  model.fixedGain = sigma;
  model.gain = sigma;
  const rand = createRng(seed + 1);
  for (let c = 0; c < cascades; c++) {
    model.ignite((rand() * nodes) | 0);
    while (!model.idle()) model.step();
  }
  return model.fired / cascades;
}
