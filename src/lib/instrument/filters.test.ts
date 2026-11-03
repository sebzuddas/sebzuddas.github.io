import { describe, expect, it } from 'vitest';
import { abs, add } from './signal';
import { design, gain, orderOf, polesOf, response, zerosOf, type Design, type Family, type Response } from './filters';

const base: Design = { family: 'butterworth', response: 'lowpass', order: 4, cutoff: 0.1, width: 0.05, ripple: 1, stopband: 40 };
const db = (value: number) => 20 * Math.log10(value);
const make = (over: Partial<Design>) => design({ ...base, ...over });

describe('Butterworth', () => {
  it('is 3 dB down at the cutoff at every order', () => {
    for (let order = 1; order <= 8; order++) expect(db(gain(make({ order }), 0.1))).toBeCloseTo(-3.01, 2);
  });
  it('is maximally flat at DC', () => {
    expect(db(gain(make({ order: 6 }), 0.03))).toBeGreaterThan(-0.01);
  });
  it('rolls off at 20 dB a decade per order', () => {
    const sections = make({ order: 3, cutoff: 0.002 });
    expect(db(gain(sections, 0.02))).toBeCloseTo(-60, 0);
  });
});

describe('Chebyshev', () => {
  it('type I ripples by the set amount and meets it at the cutoff', () => {
    const sections = make({ family: 'chebyshev1', order: 5, ripple: 2 });
    expect(db(gain(sections, 0.1))).toBeCloseTo(-2, 3);
    let lowest = 0;
    for (let f = 0; f <= 0.1; f += 0.001) lowest = Math.min(lowest, db(gain(sections, f)));
    expect(lowest).toBeGreaterThan(-2.02);
  });
  it('type II holds the stopband from the cutoff upward', () => {
    const sections = make({ family: 'chebyshev2', order: 5, stopband: 35 });
    expect(db(gain(sections, 0.1))).toBeCloseTo(-35, 2);
    for (let f = 0.1; f < 0.5; f += 0.002) expect(db(gain(sections, f))).toBeLessThan(-34.9);
    expect(db(gain(sections, 0))).toBeCloseTo(0, 3);
  });
});

describe('elliptic', () => {
  for (const order of [2, 3, 4, 5, 8]) {
    it(`meets ripple and stopband at order ${order}`, () => {
      const sections = make({ family: 'elliptic', order, ripple: 1, stopband: 40 });
      expect(db(gain(sections, 0.1))).toBeCloseTo(-1, 2);
      let lowest = 0;
      for (let f = 0; f <= 0.1; f += 0.0005) lowest = Math.min(lowest, db(gain(sections, f)));
      expect(lowest).toBeGreaterThan(-1.01);
      let far = -Infinity;
      for (let f = 0.48; f < 0.5; f += 0.001) far = Math.max(far, db(gain(sections, f)));
      expect(far).toBeLessThan(-39.9);
    });
  }
  it('is steeper than Butterworth at the same order', () => {
    const steep = gain(make({ family: 'elliptic', order: 4 }), 0.13);
    expect(steep).toBeLessThan(gain(make({}), 0.13));
  });
});

describe('Bessel', () => {
  it('is 3 dB down at the cutoff', () => {
    for (const order of [1, 2, 4, 8]) expect(db(gain(make({ family: 'bessel', order, cutoff: 0.02 }), 0.02))).toBeCloseTo(-3.01, 1);
  });
  it('matches the second-order textbook poles', () => {
    const sections = make({ family: 'bessel', order: 2, cutoff: 0.001 });
    const [p] = polesOf(sections);
    const s = Math.atan2(Math.abs(p.im), p.re) / (2 * Math.PI * 0.001);
    const damping = -Math.log(abs(p)) / (2 * Math.PI * 0.001);
    expect(s / damping).toBeCloseTo(1 / Math.sqrt(3), 2);
  });
  it('has steadier delay than Butterworth', () => {
    const delay = (family: Family, f: number) => {
      const h = 1e-5;
      const phase = (x: number) => {
        const r = response(make({ family, order: 6, cutoff: 0.05 }), x);
        return Math.atan2(r.im, r.re);
      };
      return -(phase(f + h) - phase(f - h)) / (2 * h * 2 * Math.PI);
    };
    const spread = (family: Family) => Math.abs(delay(family, 0.04) - delay(family, 0.005));
    expect(spread('bessel')).toBeLessThan(spread('butterworth') / 2);
  });
});

describe('Linkwitz-Riley', () => {
  it('is 6 dB down at the crossover', () => {
    expect(db(gain(make({ family: 'linkwitz', order: 4 }), 0.1))).toBeCloseTo(-6.02, 2);
  });
  it('adds back to a flat response with its high-pass partner', () => {
    const low = make({ family: 'linkwitz', order: 4 });
    const high = make({ family: 'linkwitz', order: 4, response: 'highpass' });
    for (let f = 0.01; f < 0.45; f += 0.02) expect(abs(add(response(low, f), response(high, f)))).toBeCloseTo(1, 3);
  });
  it('rounds an odd order up to an even one', () => {
    expect(orderOf(make({ family: 'linkwitz', order: 3 }))).toBe(4);
  });
});

describe('every family and response', () => {
  const families: Family[] = ['butterworth', 'chebyshev1', 'chebyshev2', 'elliptic', 'bessel', 'linkwitz'];
  const responses: Response[] = ['lowpass', 'highpass', 'bandpass', 'bandstop'];
  it('stays stable and real across the controls', () => {
    for (const family of families) for (const r of responses) for (const order of [1, 2, 5, 8]) for (const cutoff of [0.02, 0.2, 0.45]) {
      const sections = make({ family, response: r, order, cutoff, width: 0.04 });
      polesOf(sections).forEach((z) => expect(abs(z), `${family} ${r} ${order} ${cutoff}`).toBeLessThan(1));
      sections.forEach(({ a, b }) => [...a, ...b].forEach((value) => expect(Number.isFinite(value)).toBe(true)));
    }
  });
  it('passes and stops the right bands', () => {
    expect(gain(make({ response: 'highpass' }), 0.01)).toBeLessThan(0.01);
    expect(gain(make({ response: 'highpass' }), 0.4)).toBeCloseTo(1, 3);
    expect(gain(make({ response: 'bandpass', cutoff: 0.2, width: 0.05 }), 0.2)).toBeCloseTo(1, 2);
    expect(gain(make({ response: 'bandpass', cutoff: 0.2, width: 0.05 }), 0.05)).toBeLessThan(0.01);
    expect(gain(make({ response: 'bandstop', cutoff: 0.2, width: 0.05 }), 0.2)).toBeLessThan(0.001);
    expect(gain(make({ response: 'bandstop', cutoff: 0.2, width: 0.05 }), 0.45)).toBeCloseTo(1, 2);
  });
  it('doubles the order for a band', () => {
    expect(orderOf(make({ response: 'bandpass', order: 3 }))).toBe(6);
    expect(zerosOf(make({ order: 4 })).length).toBe(4);
  });
});
