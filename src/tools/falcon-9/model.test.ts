import { describe, expect, it } from 'vitest';
import { AxisMPC } from './mpc';
import { BoxQP } from './qp';
import { legWireframe, shipWireframe } from './ship';
import { DRAG, DT, FUEL, G, LEG_ALTITUDE, LIMITS, PAD_RADIUS, Falcon9, type Input } from './model';

const still: Input = { lateral: 0, vertical: 0 };

describe('dynamics', () => {
  it('free fall with quadratic drag matches the closed form within 1%', () => {
    const s = new Falcon9('manual', 1);
    s.vz = 0; s.vx = 0; s.theta = 0; s.z = 5000;
    const seconds = 12;
    for (let i = 0; i < seconds / DT; i++) s.step(still);
    const terminal = Math.sqrt(G / DRAG);
    const expected = (terminal ** 2 / G) * Math.log(Math.cosh((G * seconds) / terminal));
    const fallen = 5000 - s.z;
    expect(Math.abs(fallen - expected) / expected).toBeLessThan(0.01);
  });

  it('steering right tilts the nose right and moves the ship right', () => {
    const s = new Falcon9('manual', 1);
    s.theta = 0; s.omega = 0; s.vx = 0;
    s.stick = 1;
    for (let i = 0; i < 200; i++) s.step({ lateral: 1, vertical: 0 });
    expect(s.theta).toBeGreaterThan(0);
    expect(s.vx).toBeGreaterThan(0);
  });

  it('burns no more fuel than it carries', () => {
    const s = new Falcon9('manual', 2);
    s.z = 1e6; s.stick = 1;
    for (let i = 0; i < 100 / DT; i++) s.step(still);
    expect(s.fuel).toBe(0);
    expect(s.throttle).toBe(0);
    expect(s.mass).toBeCloseTo(1 - FUEL, 9);
  });
});

describe('QP solver', () => {
  it('satisfies the optimality conditions under active constraints', () => {
    const H = [Float64Array.of(4, 1, 0), Float64Array.of(1, 3, 1), Float64Array.of(0, 1, 2)];
    const f = Float64Array.of(-8, -3, 4);
    const lb = new Float64Array(3).fill(-1);
    const ub = new Float64Array(3).fill(1);
    const qp = new BoxQP(H);
    const u = qp.solve(new Float64Array(3), f, lb, ub, 2000);
    const g = new Float64Array(3);
    qp.gradient(u, f, g);
    u.forEach((value, i) => {
      if (value >= 1 - 1e-9) expect(g[i]).toBeLessThanOrEqual(1e-6);
      else if (value <= -1 + 1e-9) expect(g[i]).toBeGreaterThanOrEqual(-1e-6);
      else expect(Math.abs(g[i])).toBeLessThan(1e-6);
    });
  });

  it('drives a double integrator to its reference', () => {
    const mpc = new AxisMPC(20, 0.25, 0.1, 1, 0.1, 5);
    const ref = new Float64Array(20);
    let p = 50, v = 0;
    for (let i = 0; i < 80; i++) {
      const a = mpc.solve(p, v, ref, ref, -3, 3);
      expect(Math.abs(a)).toBeLessThanOrEqual(3);
      v += a * 0.25; p += v * 0.25;
    }
    expect(Math.abs(p)).toBeLessThan(0.5);
    expect(Math.abs(v)).toBeLessThan(0.2);
  });
});

function fly(mode: 'auto' | 'assist', seed: number, input: (s: Falcon9) => Input = () => still) {
  const s = new Falcon9(mode, seed);
  while (!s.outcome && s.tick < 180 / DT) s.step(input(s));
  return s;
}

describe('autopilot', () => {
  it('is deterministic', () => {
    const a = fly('auto', 9);
    const b = fly('auto', 9);
    expect([a.x, a.vz, a.tick]).toEqual([b.x, b.vz, b.tick]);
  });
});

describe('assisted', () => {
  it('a pilot who steers toward the pad lands safely', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = fly('assist', seed, (ship) => ({
        lateral: Math.max(-1, Math.min(1, -ship.x / 40)),
        vertical: 0,
        depth: Math.max(-1, Math.min(1, -ship.y / 40)),
      }));
      expect(s.outcome, `seed ${seed}`).toBe('landed');
    }
  });
  it('a pilot who does nothing lands softly but misses the pad', () => {
    expect(fly('assist', 3).outcome).toBe('missed');
  });
});

describe('autopilot flight', () => {
  it('lands from 60 different starts', () => {
    const failures: string[] = [];
    let miss = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = fly('auto', seed);
      if (s.outcome !== 'landed') failures.push(`${seed}: ${s.outcome} x ${s.x.toFixed(1)} y ${s.y.toFixed(1)} vx ${s.vx.toFixed(2)} vy ${s.vy.toFixed(2)} vz ${s.vz.toFixed(2)}`);
      miss = Math.max(miss, Math.hypot(s.x, s.y));
    }
    console.log('worst miss', miss);
    expect(failures).toEqual([]);
  }, 60000);

  it('starts off the pad on both axes', () => {
    const s = new Falcon9('auto', 3);
    expect(Math.abs(s.y)).toBeGreaterThan(50);
  });

  it('forward steering moves the ship forward', () => {
    const s = new Falcon9('manual', 1);
    s.phi = 0; s.vy = 0; s.stick = 1;
    for (let i = 0; i < 200; i++) s.step({ lateral: 0, vertical: 0, depth: 1 });
    expect(s.phi).toBeGreaterThan(0);
    expect(s.vy).toBeGreaterThan(0);
  });
});

describe('legs', () => {
  it('stay stowed high up and lock out before an autopilot touchdown', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = new Falcon9('auto', seed);
      while (s.z >= LEG_ALTITUDE) {
        s.step(still);
        if (s.z >= LEG_ALTITUDE) expect(s.legs).toBe(0);
      }
      while (!s.outcome) s.step(still);
      expect(s.legs, `seed ${seed}`).toBe(1);
    }
  }, 60000);

  it('have their feet on the ground when out, and lie along the hull when stowed', () => {
    const height = (w: Float32Array, pick: (a: number, b: number) => number) => {
      let y = w[1];
      for (let i = 1; i < w.length; i += 3) y = pick(y, w[i]);
      return y;
    };
    expect(height(legWireframe(1), Math.min)).toBeCloseTo(0, 5);
    expect(height(shipWireframe(), Math.min)).toBeGreaterThan(0.5);
    expect(height(legWireframe(0), Math.min)).toBeGreaterThan(2);
    const widest = (w: Float32Array) => {
      let r = 0;
      for (let i = 0; i < w.length; i += 3) r = Math.max(r, Math.hypot(w[i], w[i + 2]));
      return r;
    };
    expect(widest(legWireframe(0))).toBeLessThan(3);
    expect(widest(legWireframe(1))).toBeGreaterThan(10);
  });
});

describe('manual', () => {
  it('doing nothing crashes', () => {
    const s = new Falcon9('manual', 4);
    while (!s.outcome) s.step(still);
    expect(s.outcome).toBe('hard');
  });
});
