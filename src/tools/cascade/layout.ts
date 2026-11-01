import { createRng } from '../../lib/instrument/rng';
import { COLS, ROWS, type Graph } from './model';

export type Skin = 'neural' | 'transit';
export type Point = [number, number];

export interface Layout {
  nodes: Point[];
  /** Path of each edge, as `paths[from][edgeIndex]`, in unit coordinates. */
  paths: Point[][][];
}

const X = (c: number) => (c + 0.75) / (COLS + 0.5);
const Y = (r: number) => (r + 0.75) / (ROWS + 0.5);

/** Same graph, organic: jittered somas joined by curved axons. */
function neural(graph: Graph, seed: number): Layout {
  const rand = createRng(seed ^ 0x2f6e2b1);
  const nodes = graph.map((_, i): Point => [
    X(i % COLS) + (rand() - 0.5) * 0.042,
    Y((i / COLS) | 0) + (rand() - 0.5) * 0.07,
  ]);
  const paths = graph.map((edges, i) =>
    edges.map((edge) => {
      const [ax, ay] = nodes[i];
      const [bx, by] = nodes[edge.to];
      const bow = (edge.long ? 0.18 : 0.14) * (rand() < 0.5 ? -1 : 1);
      const cx = (ax + bx) / 2 - (by - ay) * bow;
      const cy = (ay + by) / 2 + (bx - ax) * bow;
      const path: Point[] = [];
      for (let s = 0; s <= 8; s++) {
        const t = s / 8;
        const q = 1 - t;
        path.push([q * q * ax + 2 * q * t * cx + t * t * bx, q * q * ay + 2 * q * t * cy + t * t * by]);
      }
      return path;
    }),
  );
  return { nodes, paths };
}

/** Same graph, schematic: a grid of stations with 45 degree routing. */
function transit(graph: Graph): Layout {
  const nodes = graph.map((_, i): Point => [X(i % COLS), Y((i / COLS) | 0)]);
  const paths = graph.map((edges, i) =>
    edges.map((edge) => {
      const ac = i % COLS;
      const ar = (i / COLS) | 0;
      const dc = edge.to % COLS - ac;
      const dr = ((edge.to / COLS) | 0) - ar;
      const diagonal = Math.min(Math.abs(dc), Math.abs(dr));
      const c = ac + Math.sign(dc) * diagonal;
      const r = ar + Math.sign(dr) * diagonal;
      return [nodes[i], [X(c), Y(r)] as Point, nodes[edge.to]];
    }),
  );
  return { nodes, paths };
}

export function layoutFor(skin: Skin, graph: Graph, seed: number): Layout {
  return skin === 'transit' ? transit(graph) : neural(graph, seed);
}

/** Point a fraction of the way along a polyline. */
export function along(path: Point[], t: number): Point {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    lengths.push(d);
    total += d;
  }
  let left = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] ? left / lengths[i] : 0;
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * f,
        path[i][1] + (path[i + 1][1] - path[i][1]) * f,
      ];
    }
    left -= lengths[i];
  }
  return path[path.length - 1];
}
