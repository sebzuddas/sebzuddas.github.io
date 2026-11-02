import { describe, expect, it } from 'vitest';
import { abs, fft, fromRoots, polyval, roots, sub, trim } from './signal';

const sorted = (list: { re: number; im: number }[]) => [...list].sort((a, b) => a.re - b.re || a.im - b.im);

describe('roots', () => {
  it('finds real roots', () => {
    const found = sorted(roots([1, 6, 11, 6]));
    [-3, -2, -1].forEach((r, i) => {
      expect(found[i].re).toBeCloseTo(r, 9);
      expect(found[i].im).toBe(0);
    });
  });
  it('finds a conjugate pair', () => {
    const found = sorted(roots([1, 2, 5]));
    expect(found[0]).toMatchObject({ re: expect.closeTo(-1, 9), im: expect.closeTo(-2, 9) });
    expect(found[1]).toMatchObject({ re: expect.closeTo(-1, 9), im: expect.closeTo(2, 9) });
  });
  it('takes roots at the origin exactly', () => {
    expect(roots([1, 1, 0, 0]).filter((r) => r.re === 0 && r.im === 0)).toHaveLength(2);
  });
  it('handles a double root', () => {
    roots([1, 4, 4]).forEach((r) => expect(abs(sub(r, { re: -2, im: 0 }))).toBeLessThan(1e-5));
  });
  it('survives order 8 and satisfies the polynomial', () => {
    const poly = [1, 5.1258, 13.1371, 21.8462, 25.6884, 21.8462, 13.1371, 5.1258, 1];
    const found = roots(poly);
    expect(found).toHaveLength(8);
    found.forEach((r) => expect(abs(polyval(poly, r))).toBeLessThan(1e-6));
  });
});

describe('polynomials', () => {
  it('rebuilds a polynomial from its roots', () => {
    fromRoots(roots([1, 2, 5])).forEach((c, i) => expect(c).toBeCloseTo([1, 2, 5][i], 9));
  });
  it('trims leading zeros and tiny leaders', () => {
    expect(trim([0, 0, 2, 1])).toEqual([2, 1]);
    expect(trim([1e-14, 2, 1], 1e-10)).toEqual([2, 1]);
    expect(trim([0, 0])).toEqual([]);
  });
});

describe('fft', () => {
  it('puts a whole-cycle sine in one bin', () => {
    const n = 256;
    const re = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 10 * i) / n));
    const im = new Float64Array(n);
    fft(re, im);
    const size = re.map((value, i) => Math.hypot(value, im[i]));
    expect(size[10]).toBeCloseTo(n / 2, 8);
    expect(size[11]).toBeLessThan(1e-9);
  });
  it('keeps energy, by Parseval', () => {
    const n = 64;
    const signal = Array.from({ length: n }, (_, i) => Math.cos(i * i * 0.3));
    const re = Float64Array.from(signal);
    const im = new Float64Array(n);
    fft(re, im);
    const time = signal.reduce((sum, value) => sum + value * value, 0);
    const frequency = re.reduce((sum, value, i) => sum + value * value + im[i] * im[i], 0) / n;
    expect(frequency).toBeCloseTo(time, 8);
  });
});
