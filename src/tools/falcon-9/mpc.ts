import { BoxQP } from './qp';

/**
 * Receding-horizon tracker for a double integrator, one axis at a time.
 * Predicted position and velocity are linear in the accelerations, so each
 * solve is a small box-constrained QP.
 */
export class AxisMPC {
  readonly N: number;
  private Gp: Float64Array[];
  private Gv: Float64Array[];
  private qp: BoxQP;
  private plan: Float64Array;
  private f: Float64Array;
  private lb: Float64Array;
  private ub: Float64Array;

  constructor(
    N: number,
    private dt: number,
    private wp: number,
    private wv: number,
    wu: number,
    private wTerminal: number,
  ) {
    this.N = N;
    this.Gp = [];
    this.Gv = [];
    for (let k = 0; k < N; k++) {
      const gp = new Float64Array(N);
      const gv = new Float64Array(N);
      for (let j = 0; j <= k; j++) {
        gv[j] = dt;
        gp[j] = dt * dt * (k - j + 0.5);
      }
      this.Gp.push(gp);
      this.Gv.push(gv);
    }
    const H = Array.from({ length: N }, () => new Float64Array(N));
    for (let k = 0; k < N; k++) {
      const w = k === N - 1 ? wTerminal : 1;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          H[i][j] += w * (wp * this.Gp[k][i] * this.Gp[k][j] + wv * this.Gv[k][i] * this.Gv[k][j]);
        }
      }
      H[k][k] += wu;
    }
    this.qp = new BoxQP(H);
    this.plan = new Float64Array(N);
    this.f = new Float64Array(N);
    this.lb = new Float64Array(N);
    this.ub = new Float64Array(N);
  }

  /** Returns the first acceleration of the plan. Reference arrays have length N. */
  solve(p: number, v: number, pRef: Float64Array, vRef: Float64Array, min: number, max: number): number {
    const { N, dt, f, Gp, Gv, plan } = this;
    f.fill(0);
    for (let k = 0; k < N; k++) {
      const t = (k + 1) * dt;
      const ep = p + v * t - pRef[k];
      const ev = v - vRef[k];
      const w = k === N - 1 ? this.wTerminal : 1;
      for (let i = 0; i < N; i++) f[i] += w * (this.wp * ep * Gp[k][i] + this.wv * ev * Gv[k][i]);
    }
    this.lb.fill(min);
    this.ub.fill(max);
    // Warm start: last plan, shifted by the elapsed control step.
    plan.copyWithin(0, 1);
    for (let i = 0; i < N; i++) plan[i] = Math.min(max, Math.max(min, plan[i]));
    this.qp.solve(plan, f, this.lb, this.ub);
    return plan[0];
  }

  /** Predicted positions of the current plan, for drawing. */
  predicted(p: number, v: number, out: Float64Array) {
    const { N, Gp, plan, dt } = this;
    for (let k = 0; k < N; k++) {
      let s = p + v * (k + 1) * dt;
      for (let i = 0; i < N; i++) s += Gp[k][i] * plan[i];
      out[k] = s;
    }
  }
}
