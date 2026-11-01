/** Box-constrained QP: min ½uᵀHu + fᵀu with lb ≤ u ≤ ub, by accelerated projected gradient. */
export class BoxQP {
  private step: number;

  constructor(private H: Float64Array[]) {
    this.step = 1 / largestEigenvalue(H);
  }

  gradient(u: Float64Array, f: Float64Array, out: Float64Array) {
    for (let i = 0; i < u.length; i++) {
      let g = f[i];
      const row = this.H[i];
      for (let j = 0; j < u.length; j++) g += row[j] * u[j];
      out[i] = g;
    }
  }

  /** Solves in place, warm-started from u. */
  solve(u: Float64Array, f: Float64Array, lb: Float64Array, ub: Float64Array, iterations = 120) {
    const n = u.length;
    const y = u.slice();
    const g = new Float64Array(n);
    const previous = new Float64Array(n);
    let t = 1;
    for (let k = 0; k < iterations; k++) {
      this.gradient(y, f, g);
      previous.set(u);
      for (let i = 0; i < n; i++) u[i] = Math.min(ub[i], Math.max(lb[i], y[i] - this.step * g[i]));
      const next = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
      const beta = (t - 1) / next;
      for (let i = 0; i < n; i++) y[i] = u[i] + beta * (u[i] - previous[i]);
      t = next;
    }
    return u;
  }
}

function largestEigenvalue(H: Float64Array[]): number {
  const n = H.length;
  let v = new Float64Array(n).fill(1);
  let lambda = 1;
  for (let k = 0; k < 60; k++) {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) w[i] += H[i][j] * v[j];
    lambda = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
    v = w.map((x) => x / lambda);
  }
  return lambda * 1.01;
}
