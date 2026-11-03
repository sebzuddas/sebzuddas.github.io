import { describe, expect, it } from 'vitest';
import { abs, sub } from '../../lib/instrument/signal';
import { coefficients, dcGain, discretise, expm, grouped, metrics, parse, poles, simulate, stability, surface, timeSpan, ungrouped, zeros, type Transfer } from './model';

const second = (zeta: number, wn: number): Transfer => ({ num: [wn * wn], den: [1, 2 * zeta * wn, wn * wn] });
const run = (system: Transfer, samples = 40000) => simulate(system, timeSpan(poles(system)), samples);
const at = (trace: { t: number[]; y: number[] }, time: number) => trace.y[trace.t.findIndex((t) => t >= time)];

/** Closed form of wn²/(s² + 2ζwn s + wn²), the published reference for this tool. */
function exact(zeta: number, wn: number, t: number) {
  const wd = wn * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + (zeta * wn * Math.sin(wd * t)) / wd);
}

describe('second order against the textbook', () => {
  it('matches overshoot and peak time at ζ=0.5', () => {
    const m = metrics(run(second(0.5, 1)), 1);
    expect(m.overshoot).toBeCloseTo(16.303, 2);
    expect(m.peakTime!).toBeCloseTo(3.6276, 2);
  });
  it('matches the closed form along the whole response', () => {
    const trace = run(second(0.3, 2), 8000);
    trace.t.forEach((t, i) => expect(trace.y[i]).toBeCloseTo(exact(0.3, 2, t), 7));
  });
  it('matches critical damping with its repeated pole', () => {
    expect(at(run(second(1, 1)), 2)).toBeCloseTo(1 - 3 * Math.exp(-2), 3);
    expect(metrics(run(second(1, 1)), 1).rise!).toBeCloseTo(3.3579, 2);
  });
  it('scales time with natural frequency', () => {
    const slow = metrics(run(second(0.7, 1)), 1);
    const fast = metrics(run(second(0.7, 10)), 1);
    expect(slow.rise! / fast.rise!).toBeCloseTo(10, 1);
  });
  it('stays in the 2% band after the settling time', () => {
    const trace = run(second(0.5, 1));
    const { settle } = metrics(trace, 1);
    trace.t.forEach((t, i) => {
      if (t > settle + 1e-3) expect(Math.abs(trace.y[i] - 1)).toBeLessThanOrEqual(0.02 + 1e-9);
    });
    expect(settle).toBeGreaterThan(0);
  });
  it('has no overshoot when overdamped', () => {
    const m = metrics(run(second(1.5, 1)), 1);
    expect(m.overshoot).toBe(0);
    expect(m.peakTime).toBeUndefined();
  });
});

describe('any order', () => {
  it('matches first order', () => {
    const system = { num: [2], den: [1, 3] };
    const trace = run(system, 4000);
    trace.t.forEach((t, i) => expect(trace.y[i]).toBeCloseTo((2 / 3) * (1 - Math.exp(-3 * t)), 8));
  });
  it('matches third order by partial fractions', () => {
    const trace = run({ num: [6], den: [1, 6, 11, 6] }, 4000);
    trace.t.forEach((t, i) => expect(trace.y[i]).toBeCloseTo(1 - 3 * Math.exp(-t) + 3 * Math.exp(-2 * t) - Math.exp(-3 * t), 7));
  });
  it('matches a triple pole', () => {
    const trace = run({ num: [1], den: [1, 3, 3, 1] }, 4000);
    trace.t.forEach((t, i) => expect(trace.y[i]).toBeCloseTo(1 - Math.exp(-t) * (1 + t + (t * t) / 2), 7));
  });
  it('steps straight to the direct path when poles and zeros are equal in number', () => {
    const trace = simulate({ num: [1, 3], den: [1, 1] }, 5, 2000);
    expect(trace.y[0]).toBe(1);
    trace.t.forEach((t, i) => expect(trace.y[i]).toBeCloseTo(3 - 2 * Math.exp(-t), 8));
  });
  it('dips first with a right half plane zero', () => {
    const trace = run({ num: [-1, 1], den: [1, 2, 1] }, 4000);
    expect(Math.min(...trace.y)).toBeLessThan(-0.05);
    trace.t.forEach((t, i) => expect(trace.y[i]).toBeCloseTo(1 - Math.exp(-t) - 2 * t * Math.exp(-t), 7));
  });
  it('handles a plain gain and an integrator', () => {
    expect(simulate({ num: [3], den: [1] }, 1).y[1]).toBe(3);
    const ramp = simulate({ num: [1], den: [1, 0] }, 4, 400);
    expect(ramp.y[400]).toBeCloseTo(4, 9);
  });
  it('stops rather than overflowing when unstable', () => {
    const trace = simulate({ num: [1], den: [1, -5] }, 100);
    expect(trace.t.length).toBeLessThan(4001);
    expect(trace.y.every(Number.isFinite)).toBe(true);
  });
});

describe('expm', () => {
  it('matches a rotation', () => {
    const [[a, b]] = expm([[0, 1], [-1, 0]]);
    expect(a).toBeCloseTo(Math.cos(1), 12);
    expect(b).toBeCloseTo(Math.sin(1), 12);
  });
});

describe('reading the function', () => {
  const ok = (num: string, den: string, gain = 1) => {
    const parsed = parse(num, den, gain);
    if (!parsed.ok) throw new Error(parsed.reason);
    return parsed.system;
  };
  it('normalises and applies gain', () => {
    expect(ok('2 4', '2 2 2', 3)).toEqual({ num: [3, 6], den: [1, 1, 1] });
    expect(ok('1', '0 1 1').den).toEqual([1, 1]);
  });
  it('refuses what cannot be simulated', () => {
    expect(parse('abc', '1 1', 1)).toMatchObject({ ok: false });
    expect(parse('1', '0 0', 1)).toMatchObject({ ok: false });
    expect(parse('1 0 0', '1 1', 1)).toMatchObject({ ok: false, reason: expect.stringContaining('zeros') });
    expect(parse('1', '1 1 1 1 1 1 1 1 1 1', 1)).toMatchObject({ ok: false, reason: expect.stringContaining('8') });
  });
  it('classifies stability', () => {
    expect(stability(poles({ num: [1], den: [1, 1] }))).toBe('Stable');
    expect(stability(poles({ num: [1], den: [1, 0, 1] }))).toBe('Marginal');
    expect(stability(poles({ num: [1], den: [1, -1] }))).toBe('Unstable');
  });
  it('finds DC gain, and none with an integrator', () => {
    expect(dcGain({ num: [6], den: [1, 2, 3] })).toBe(2);
    expect(dcGain({ num: [1], den: [1, 0] })).toBeUndefined();
  });
  it('keeps conjugate pairs together', () => {
    const system = { num: [1], den: [1, 3, 4, 2] };
    const list = grouped(poles(system));
    expect(list).toHaveLength(2);
    ungrouped(list).forEach((p) => expect(poles(system).some((q) => abs(sub(p, q)) < 1e-6)).toBe(true));
  });
  it('writes coefficients to four figures', () => {
    expect(coefficients([1, 0.123456, 20])).toBe('1 0.1235 20');
  });
});

describe('zero-order hold', () => {
  it('puts each pole at e^(pT)', () => {
    const system = second(0.3, 2);
    const period = 0.4;
    const z = discretise(system, period)!;
    const s = poles(system)[0];
    const wanted = { re: Math.exp(s.re * period) * Math.cos(s.im * period), im: Math.exp(s.re * period) * Math.sin(s.im * period) };
    expect(Math.min(...z.poles.map((p) => abs(sub(p, wanted))))).toBeLessThan(1e-9);
  });
  it('matches the standard first-order result', () => {
    const z = discretise({ num: [1], den: [1, 1] }, 0.5)!;
    const e = Math.exp(-0.5);
    expect(z.num[0]).toBeCloseTo(1 - e, 10);
    expect(z.poles[0].re).toBeCloseTo(e, 10);
  });
  it('reproduces the continuous step at every sample', () => {
    const system = { num: [6], den: [1, 6, 11, 6] };
    const period = 0.25;
    const z = discretise(system, period)!;
    const padded = [...Array(z.den.length - z.num.length).fill(0), ...z.num];
    const output: number[] = [];
    for (let k = 0; k < 24; k++) {
      const forced = padded.reduce((sum, b, i) => sum + (k - i >= 0 ? b : 0), 0);
      const fed = z.den.slice(1).reduce((sum, a, i) => sum + (k - i - 1 >= 0 ? a * output[k - i - 1] : 0), 0);
      output.push(forced - fed);
    }
    output.forEach((value, k) => {
      const t = k * period;
      expect(value).toBeCloseTo(1 - 3 * Math.exp(-t) + 3 * Math.exp(-2 * t) - Math.exp(-3 * t), 7);
    });
  });
  it('has no finite zero issue with a direct path', () => {
    expect(zeros({ num: [1, 3], den: [1, 1] })[0].re).toBeCloseTo(-3, 9);
    expect(discretise({ num: [1, 3], den: [1, 1] }, 0.1)!.zeros).toHaveLength(1);
  });
  it('gives up on a pole too large to hold', () => {
    expect(discretise({ num: [1], den: [1, -100] }, 1)).toBeUndefined();
  });
});

describe('surface', () => {
  it('peaks at a pole and dips at a zero', () => {
    const [row] = surface([1, 1], [1, 2], [-2, -1, 3], [0]);
    expect(row[0]).toBe(1.5);
    expect(row[1]).toBe(-1.5);
    expect(row[2]).toBeCloseTo(Math.log10(4 / 5), 9);
  });
});
