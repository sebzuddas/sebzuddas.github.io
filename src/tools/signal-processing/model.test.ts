import { describe, expect, it } from 'vitest';
import { NYQUIST, RATE, SPECTRUM_SIZE, alias, apply, biquad, decibels, gainAt, handmade, mixed, polesOf, sample, spectrum, zerosOf, type Pair } from './model';
import type { Section } from '../../lib/instrument/filters';

const bin = (hz: number) => Math.round((hz * SPECTRUM_SIZE) / RATE);
const none: Pair = { radius: 0, hz: 0 };
const size = (z: { re: number; im: number }) => Math.hypot(z.re, z.im);
/** Height of a sine, from its energy: samples can miss the true top of the wave. */
const height = (signal: Float64Array) => Math.sqrt((2 * signal.reduce((sum, value) => sum + value * value, 0)) / signal.length);

describe('cookbook filters', () => {
  it('is 3 dB down at the cutoff, for a Butterworth Q', () => {
    expect(decibels(gainAt([biquad('lowpass', 1000, Math.SQRT1_2)], 1000))).toBeCloseTo(-3.01, 2);
    expect(decibels(gainAt([biquad('highpass', 1000, Math.SQRT1_2)], 1000))).toBeCloseTo(-3.01, 2);
  });
  it('passes DC through a low-pass and blocks it with a high-pass', () => {
    expect(gainAt([biquad('lowpass', 1000, 1)], 0)).toBeCloseTo(1, 9);
    expect(gainAt([biquad('highpass', 1000, 1)], 0)).toBeCloseTo(0, 9);
  });
  it('peaks at unity with a band-pass and vanishes with a notch', () => {
    expect(gainAt([biquad('bandpass', 1500, 4)], 1500)).toBeCloseTo(1, 9);
    expect(gainAt([biquad('bandstop', 1500, 4)], 1500)).toBeCloseTo(0, 9);
  });
  it('stays stable across every setting of the controls', () => {
    for (const kind of ['lowpass', 'highpass', 'bandpass', 'bandstop'] as const) {
      for (let cutoff = 50; cutoff <= 3900; cutoff += 150) {
        for (const q of [0.3, 0.7, 2, 10]) polesOf([biquad(kind, cutoff, q)]).forEach((z) => expect(size(z)).toBeLessThan(1));
      }
    }
  });
});

describe('running a filter', () => {
  it('scales a sine by the computed gain', () => {
    const sections = [biquad('lowpass', 1000, 1)];
    const input = Float64Array.from({ length: RATE }, (_, i) => sample('sine', (2000 * i) / RATE));
    expect(height(apply(sections, input))).toBeCloseTo(gainAt(sections, 2000), 6);
  });
  it('joins cleanly into a loop', () => {
    const input = mixed({ wave: 'saw', frequency: 220, level: 1 }, { wave: 'sine', frequency: 701, level: 1 }, 'add');
    const output = apply([biquad('lowpass', 800, 4)], input);
    const again = apply([biquad('lowpass', 800, 4)], Float64Array.from([...input, ...input]));
    for (let i = 0; i < 200; i++) expect(output[i]).toBeCloseTo(again[RATE + i], 6);
  });
  it('runs every section in turn', () => {
    const sections: Section[] = [biquad('lowpass', 1000, 1), biquad('lowpass', 1000, 1)];
    const input = Float64Array.from({ length: RATE }, (_, i) => sample('sine', (500 * i) / RATE));
    expect(height(apply(sections, input))).toBeCloseTo(gainAt(sections, 500), 6);
  });
});

describe('placing poles and zeros by hand', () => {
  it('puts them where they were asked', () => {
    const sections = handmade([{ radius: 0.9, hz: 1000 }, none], [{ radius: 1, hz: 3000 }, none]);
    const pole = polesOf(sections)[0];
    expect(size(pole)).toBeCloseTo(0.9, 9);
    expect((Math.abs(Math.atan2(pole.im, pole.re)) * RATE) / (2 * Math.PI)).toBeCloseTo(1000, 6);
    expect(size(zerosOf(sections)[0])).toBeCloseTo(1, 7);
  });
  it('nulls at a zero on the circle and rings at a pole near it', () => {
    const sections = handmade([{ radius: 0.97, hz: 1000 }, none], [{ radius: 1, hz: 3000 }, none]);
    expect(gainAt(sections, 3000)).toBeLessThan(1e-9);
    expect(gainAt(sections, 1000)).toBeGreaterThan(0.95);
  });
  it('never exceeds a gain of one', () => {
    const sections = handmade([{ radius: 0.98, hz: 500 }, { radius: 0.98, hz: 505 }], [none, none]);
    for (let hz = 0; hz <= NYQUIST; hz += 5) expect(gainAt(sections, hz)).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('sources and spectrum', () => {
  it('reads a sine of height 1 as 0 dB at its frequency', () => {
    const hz = (100 * RATE) / SPECTRUM_SIZE;
    const signal = Float64Array.from({ length: RATE }, (_, i) => sample('sine', (hz * i) / RATE));
    expect(spectrum(signal)[100]).toBeCloseTo(0, 6);
  });
  it('gives a square wave odd harmonics falling as 1/n', () => {
    const hz = (32 * RATE) / SPECTRUM_SIZE;
    const signal = Float64Array.from({ length: RATE }, (_, i) => sample('square', (hz * i) / RATE));
    const s = spectrum(signal);
    expect(s[32]).toBeCloseTo(20 * Math.log10(4 / Math.PI), 1);
    expect(s[96] - s[32]).toBeCloseTo(20 * Math.log10(1 / 3), 0);
    expect(s[64]).toBeLessThan(-60);
  });
  it('makes sum and difference with ring modulation', () => {
    const s = spectrum(mixed({ wave: 'sine', frequency: 1000, level: 1 }, { wave: 'sine', frequency: 200, level: 1 }, 'ring'));
    expect(s[bin(800)]).toBeGreaterThan(-10);
    expect(s[bin(1200)]).toBeGreaterThan(-10);
    expect(s[bin(1000)]).toBeLessThan(-40);
  });
  it('folds a tone above Nyquist back down', () => {
    expect(alias(5000)).toBe(3000);
    expect(alias(3000)).toBe(3000);
    expect(alias(8100)).toBe(100);
    const s = spectrum(mixed({ wave: 'sine', frequency: 5000, level: 1 }, { wave: 'sine', frequency: 100, level: 0 }, 'add'));
    expect(s[bin(3000)]).toBeGreaterThan(-10);
  });
  it('repeats its noise from the same seed', () => {
    const noise = { wave: 'noise', frequency: 100, level: 1 } as const;
    expect(mixed(noise, noise, 'add')[100]).toBe(mixed(noise, noise, 'add')[100]);
  });
});
