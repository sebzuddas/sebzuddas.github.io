import { describe, expect, it } from 'vitest';
import { parseFormula, MAX_LENGTH } from './formula';
import { DT, convolve, outputAt, signal, type Definition } from './model';

const make = (over: Partial<Definition>) => signal({ shape: 'rect', width: 1, height: 1, formula: '', ...over });
const value = (source: string, t: number) => {
  const parsed = parseFormula(source);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.fn(t);
};

describe('convolution against closed forms', () => {
  it('turns two equal rectangles into a triangle', () => {
    const r = convolve(make({ width: 2 }), make({ width: 2 }));
    expect(outputAt(r, 0)).toBeCloseTo(2, 1);
    expect(outputAt(r, 1)).toBeCloseTo(1, 1);
    expect(outputAt(r, 2.2)).toBe(0);
  });
  it('adds the variances of two Gaussians', () => {
    const r = convolve(make({ shape: 'gauss', width: 0.5 }), make({ shape: 'gauss', width: 0.5 * Math.sqrt(3) }));
    const variance = 0.25 + 0.75;
    const scale = 2 * Math.PI * 0.5 * 0.5 * Math.sqrt(3) / Math.sqrt(2 * Math.PI * variance);
    [0, 0.5, 1.5].forEach((t) => expect(outputAt(r, t)).toBeCloseTo(scale * Math.exp(-(t * t) / (2 * variance)), 4));
  });
  it('matches exponential with exponential', () => {
    const r = convolve(make({ shape: 'exp', width: 1 }), make({ shape: 'exp', width: 1 }));
    expect(outputAt(r, 2)).toBeCloseTo(2 * Math.exp(-2), 1);
  });
  it('is commutative', () => {
    const f = make({ shape: 'gauss', width: 0.5 });
    const g = make({ shape: 'tri', width: 1.2, height: 0.7 });
    const a = convolve(f, g);
    const b = convolve(g, f);
    a.y.forEach((value, i) => expect(value).toBeCloseTo(b.y[i], 9));
  });
  it('leaves a function alone when convolved with an impulse', () => {
    const f = make({ shape: 'tri', width: 1.5 });
    const r = convolve(f, make({ shape: 'impulse', height: 1 }));
    [-1, 0, 0.7].forEach((t) => expect(outputAt(r, t)).toBeCloseTo(f.at(t), 9));
  });
  it('gives a rectangle its true area on the grid', () => {
    expect(convolve(make({ width: 2 }), make({ width: 2 })).areaF).toBeCloseTo(2, 9);
  });
  it('multiplies the areas', () => {
    const r = convolve(make({ shape: 'gauss', width: 0.4 }), make({ width: 1.5, height: 2 }));
    expect(r.y.reduce((sum, value) => sum + value, 0) * DT).toBeCloseTo(r.areaF * r.areaG, 6);
  });
  it('integrates with a step', () => {
    const r = convolve(make({ width: 2 }), make({ shape: 'step' }));
    expect(outputAt(r, 3)).toBeCloseTo(2, 1);
    expect(outputAt(r, 0)).toBeCloseTo(1, 1);
  });
  it('scales an impulse by its area, not its spike', () => {
    expect(make({ shape: 'impulse', height: 0.5 }).peak).toBe(0.5);
  });
});

describe('formula parser', () => {
  it('follows the order of operations', () => {
    expect(value('1+2*3', 0)).toBe(7);
    expect(value('(1+2)*3', 0)).toBe(9);
    expect(value('2^3^2', 0)).toBe(512);
    expect(value('-2^2', 0)).toBe(-4);
    expect(value('2*-t', 3)).toBe(-6);
  });
  it('evaluates the functions it knows', () => {
    expect(value('exp(-t)*sin(5*t)', 1)).toBeCloseTo(Math.exp(-1) * Math.sin(5), 12);
    expect(value('rect(t/2)', 0.9)).toBe(1);
    expect(value('step(t-1)', 0.9)).toBe(0);
    expect(value('max(t, pi)', 1)).toBe(Math.PI);
    expect(value('1e-1+.5', 0)).toBeCloseTo(0.6, 12);
  });
  it('turns non-finite values into zero', () => {
    expect(value('1/t', 0)).toBe(0);
    expect(value('log(t)', -1)).toBe(0);
  });
  it('refuses anything outside its list', () => {
    for (const source of ['alert(1)', 'constructor', 'toString(t)', '__proto__', 'window', 't.x', 't[0]', '"a"', 'sin', '', '1+', '(1', '1 2']) {
      expect(parseFormula(source).ok, source).toBe(false);
    }
  });
  it('limits length and nesting', () => {
    expect(parseFormula('t+'.repeat(MAX_LENGTH)).ok).toBe(false);
    expect(parseFormula('('.repeat(40) + 't' + ')'.repeat(40)).ok).toBe(false);
  });
  it('shows a mistake without breaking the signal', () => {
    const bad = make({ shape: 'formula', formula: 'sin(' });
    expect(bad.error).toBeTruthy();
    expect(bad.at(1)).toBe(0);
  });
});
