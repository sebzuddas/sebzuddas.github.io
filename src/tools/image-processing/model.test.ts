import { describe, expect, it } from 'vitest';
import { STRIPE, applyKernel, applyShape, blank, degrade, fft2, grey, ifft2, kernelOf, kernelShape, luma, psnr, radial, rings, spectrumOf, testCard, type Picture, type Settings } from './model';

const flat = (size: number, value: number): Picture => ({ size, channels: [blank(size).fill(value)] });
const settings: Settings = { family: 'butterworth', response: 'lowpass', order: 4, cutoff: 0.1, width: 0.04, ripple: 1, stopband: 40 };
const dot = (size: number): Picture => {
  const value = blank(size);
  value[(size / 2) * size + size / 2] = 1;
  return { size, channels: [value] };
};

describe('2D Fourier transform', () => {
  it('returns the original through the inverse', () => {
    const { channels: [source] } = testCard(32);
    const re = source.slice();
    const im = blank(32);
    fft2(re, im, 32);
    ifft2(re, im, 32);
    re.forEach((value, i) => expect(value).toBeCloseTo(source[i], 9));
  });
  it('puts a plane wave at its frequency', () => {
    const size = 32;
    const re = Float64Array.from({ length: size * size }, (_, i) => Math.cos((2 * Math.PI * (4 * (i % size) + 3 * Math.floor(i / size))) / size));
    const im = blank(size);
    fft2(re, im, size);
    expect(re[3 * size + 4]).toBeCloseTo((size * size) / 2, 6);
    expect(Math.abs(re[5 * size + 5])).toBeLessThan(1e-6);
  });
});

describe('kernels', () => {
  it('keep a flat image flat when they sum to one', () => {
    for (const name of ['gaussian', 'box', 'sharpen'] as const) {
      applyKernel(flat(16, 0.4), kernelOf(name, 2, '')!).channels[0].forEach((value) => expect(value).toBeCloseTo(0.4, 9));
    }
  });
  it('find nothing to outline in a flat image', () => {
    applyKernel(flat(16, 0.4), kernelOf('sobel', 1, '')!).channels[0].forEach((value) => expect(value).toBeCloseTo(0, 9));
  });
  it('find a vertical edge with Sobel', () => {
    const size = 16;
    const value = Float64Array.from({ length: size * size }, (_, i) => (i % size < 8 ? 0 : 1));
    const out = applyKernel({ size, channels: [value] }, kernelOf('sobel', 1, '')!).channels[0];
    expect(out[8 * size + 7]).toBeCloseTo(4, 9);
    expect(out[8 * size + 3]).toBeCloseTo(0, 9);
  });
  it('spread a point into the kernel itself', () => {
    const kernel = kernelOf('gaussian', 1, '')!;
    const out = applyKernel(dot(32), kernel).channels[0];
    expect(out[16 * 32 + 16]).toBeCloseTo(kernel.values[(kernel.values.length - 1) / 2], 12);
  });
  it('read a custom kernel of nine numbers and refuse anything else', () => {
    expect(kernelOf('custom', 1, '0 0 0 0 1 0 0 0 0')?.values[4]).toBe(1);
    expect(kernelOf('custom', 1, '1 2 three')).toBeUndefined();
  });
  it('show a blur as a low-pass and an outline as a high-pass', () => {
    const blur = kernelShape(kernelOf('gaussian', 2, '')!);
    expect(blur(0)).toBeCloseTo(1, 6);
    expect(blur(0.4)).toBeLessThan(0.01);
    const edges = kernelShape(kernelOf('laplacian', 1, '')!);
    expect(edges(0)).toBeCloseTo(0, 9);
  });
});

describe('frequency filters', () => {
  it('matches the 1D design at the same radius', () => {
    expect(radial(settings)(0.1)).toBeCloseTo(Math.SQRT1_2, 3);
    expect(radial({ ...settings, family: 'elliptic' })(0.4)).toBeLessThan(0.011);
  });
  it('supports an ideal filter for comparison', () => {
    const shape = radial({ ...settings, family: 'ideal' });
    expect([shape(0.09), shape(0.11)]).toEqual([1, 0]);
  });
  it('keeps the average through a low-pass and removes it with a high-pass', () => {
    const picture = testCard(32);
    const average = (p: Picture) => p.channels[0].reduce((sum, value) => sum + value, 0) / p.channels[0].length;
    expect(average(applyShape(picture, radial(settings)))).toBeCloseTo(average(picture), 6);
    expect(average(applyShape(picture, radial({ ...settings, response: 'highpass' })))).toBeCloseTo(0, 6);
  });
  it('removes stripes with a band-stop', () => {
    const clean = grey(testCard(128));
    const striped = degrade(clean, 0, 0.2);
    const r = Math.hypot(STRIPE.x, STRIPE.y);
    const fixed = applyShape(striped, radial({ ...settings, response: 'bandstop', cutoff: r, width: 0.015, order: 3 }));
    expect(psnr(clean, fixed)).toBeGreaterThan(psnr(clean, striped) + 8);
  });
  it('reduces noise with a low-pass on a smooth image', () => {
    const size = 128;
    const value = Float64Array.from({ length: size * size }, (_, i) => 0.3 + 0.4 * (i % size) / size);
    const clean = { size, channels: [value] };
    const noisy = degrade(clean, 0.1, 0);
    expect(psnr(clean, applyKernel(noisy, kernelOf('gaussian', 2, '')!))).toBeGreaterThan(psnr(clean, noisy) + 10);
  });
  it('rings with an ideal cut and not with a Gaussian-like one', () => {
    const size = 64;
    const edge = { size, channels: [Float64Array.from({ length: size * size }, (_, i) => ((i % size) < 32 ? 0.25 : 0.75))] };
    const peak = (p: Picture) => Math.max(...p.channels[0]);
    expect(peak(applyShape(edge, radial({ ...settings, family: 'ideal', cutoff: 0.15 })))).toBeGreaterThan(0.78);
    expect(peak(applyShape(edge, radial({ ...settings, family: 'bessel', order: 2, cutoff: 0.15 })))).toBeLessThan(0.77);
  });
});

describe('pictures', () => {
  it('draw a test card in range', () => {
    testCard(32).channels.forEach((channel) => channel.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }));
  });
  it('fill the spectrum with a zone plate', () => {
    expect(spectrumOf(rings(64)).reduce((sum, value) => sum + value, 0) / 4096).toBeGreaterThan(0.2);
  });
  it('add the same noise each time, for shareable links', () => {
    expect(degrade(flat(8, 0.5), 0.1, 0).channels[0]).toEqual(degrade(flat(8, 0.5), 0.1, 0).channels[0]);
  });
  it('turn grey by luminance', () => {
    expect(luma({ size: 1, channels: [Float64Array.of(1), Float64Array.of(1), Float64Array.of(1)] })[0]).toBeCloseTo(1, 9);
  });
  it('score an exact match as infinite', () => {
    expect(psnr(flat(4, 0.5), flat(4, 0.5))).toBe(Infinity);
    expect(psnr(flat(4, 0.5), flat(4, 0.6))).toBeCloseTo(20, 6);
  });
});
