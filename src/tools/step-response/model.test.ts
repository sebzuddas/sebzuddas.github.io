import { describe, expect, it } from 'vitest';
import { metrics, response } from './model';

describe('second-order step response', () => {
  it('matches textbook overshoot and peak time at ζ=0.5', () => {
    const m = metrics({ zeta: 0.5, wn: 1 });
    expect(m.overshoot).toBeCloseTo(16.303, 2);
    expect(m.peakTime).toBeCloseTo(3.6276, 3);
  });
  it('peak of the response equals the stated overshoot', () => {
    const p = { zeta: 0.3, wn: 2 };
    const m = metrics(p);
    expect(100 * (response(p, m.peakTime) - 1)).toBeCloseTo(m.overshoot, 6);
  });
  it('matches the critically damped closed form', () => {
    expect(response({ zeta: 1, wn: 1 }, 2)).toBeCloseTo(1 - 3 * Math.exp(-2), 9);
    expect(metrics({ zeta: 1, wn: 1 }).rise).toBeCloseTo(3.3579, 3);
  });
  it('is continuous either side of critical damping', () => {
    const a = response({ zeta: 0.999, wn: 1 }, 3);
    const b = response({ zeta: 1, wn: 1 }, 3);
    const c = response({ zeta: 1.001, wn: 1 }, 3);
    expect(Math.abs(a - b)).toBeLessThan(1e-3);
    expect(Math.abs(c - b)).toBeLessThan(1e-3);
  });
  it('scales time with natural frequency', () => {
    const slow = metrics({ zeta: 0.7, wn: 1 });
    const fast = metrics({ zeta: 0.7, wn: 10 });
    expect(slow.rise / fast.rise).toBeCloseTo(10, 2);
    expect(slow.settle / fast.settle).toBeCloseTo(10, 1);
  });
  it('stays in the 2% band after the settling time', () => {
    const p = { zeta: 0.5, wn: 1 };
    const { settle } = metrics(p);
    for (let t = settle + 0.01; t < 30; t += 0.01) {
      expect(Math.abs(response(p, t) - 1)).toBeLessThanOrEqual(0.02);
    }
    expect(Math.abs(response(p, settle - 0.01) - 1)).toBeGreaterThan(0.02 - 1e-3);
  });
  it('has no overshoot when overdamped', () => {
    const p = { zeta: 1.5, wn: 1 };
    expect(metrics(p).overshoot).toBe(0);
    for (let t = 0; t < 40; t += 0.1) expect(response(p, t)).toBeLessThan(1);
  });
});
