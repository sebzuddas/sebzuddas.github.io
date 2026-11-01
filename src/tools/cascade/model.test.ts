import { describe, expect, it } from 'vitest';
import { DT, hero, meanCascadeSize } from './model';

function run(closed: boolean, seconds: number, seed = 7) {
  const m = hero(seed);
  m.setpoint = 0.1;
  m.drive = 0.05;
  m.closed = closed;
  const samples: number[] = [];
  const settle = 20 / DT;
  for (let i = 0; i < seconds / DT; i++) {
    m.step();
    if (i > settle) samples.push(m.activity);
  }
  return samples;
}

const rmsError = (xs: number[], target: number) =>
  Math.sqrt(xs.reduce((sum, x) => sum + (x - target) ** 2, 0) / xs.length);

describe('analytic reference', () => {
  for (const sigma of [0.5, 0.8]) {
    it(`mean cascade size is 1/(1-σ) within 1% at σ=${sigma}`, () => {
      const size = meanCascadeSize(sigma, 300_000, 2_000_000, 11);
      const expected = 1 / (1 - sigma);
      expect(Math.abs(size - expected) / expected).toBeLessThan(0.01);
    }, 120_000);
  }
});

describe('honesty', () => {
  it('open loop swings between near silence and runaway', () => {
    const a = run(false, 120);
    console.log('open min/max', Math.min(...a), Math.max(...a));
    expect(Math.min(...a)).toBeLessThan(0.03);
    expect(Math.max(...a)).toBeGreaterThan(0.15);
  });

  it('closed loop holds the setpoint far better than open loop', () => {
    const open = rmsError(run(false, 120), 0.1);
    const closed = rmsError(run(true, 120), 0.1);
    console.log('rms open/closed', open, closed);
    expect(closed).toBeLessThan(open / 2.5);
  });

  it('closed loop holds across seeds', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const a = run(true, 90, seed);
      const mean = a.reduce((s, x) => s + x, 0) / a.length;
      expect(Math.abs(mean - 0.1)).toBeLessThan(0.02);
    }
  });
});

describe('determinism', () => {
  it('same seed gives the same trajectory', () => {
    expect(run(true, 40, 3)).toEqual(run(true, 40, 3));
  });
  it('different seeds differ', () => {
    expect(run(true, 40, 3)).not.toEqual(run(true, 40, 4));
  });
});
