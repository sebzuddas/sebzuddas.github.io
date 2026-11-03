import { abs, add, div, exp, mul, polyval, roots, sub, type Complex } from './signal';

/** One second-order section. b and a run from z^0 down, with a[0] = 1. */
export interface Section {
  b: [number, number, number];
  a: [number, number, number];
}

export type Family = 'butterworth' | 'chebyshev1' | 'chebyshev2' | 'elliptic' | 'bessel' | 'linkwitz';
export type Response = 'lowpass' | 'highpass' | 'bandpass' | 'bandstop';

export interface Design {
  family: Family;
  response: Response;
  order: number;
  /** In cycles per sample, or cycles per pixel. Below 0.5. */
  cutoff: number;
  /** Bandwidth, for band-pass and band-stop, in the same units. */
  width: number;
  /** Passband ripple in dB. */
  ripple: number;
  /** Stopband attenuation in dB. */
  stopband: number;
}

interface Prototype {
  poles: Complex[];
  zeros: Complex[];
}

const c = (re: number, im = 0): Complex => ({ re, im });
const J = c(0, 1);
const scale = (a: Complex, k: number) => c(a.re * k, a.im * k);

function sqrt(a: Complex): Complex {
  const size = abs(a);
  const re = Math.sqrt((size + a.re) / 2);
  const im = Math.sqrt((size - a.re) / 2);
  return c(re, a.im < 0 ? -im : im);
}

/** Principal arccosine, by acos(z) = -j ln(z + j sqrt(1 - z²)). */
function acos(z: Complex): Complex {
  const inner = add(z, mul(J, sqrt(sub(c(1), mul(z, z)))));
  return mul(c(0, -1), c(Math.log(abs(inner)), Math.atan2(inner.im, inner.re)));
}

function butterworth(order: number): Prototype {
  return { zeros: [], poles: Array.from({ length: order }, (_, k) => exp(c(0, (Math.PI * (2 * k + order + 1)) / (2 * order)))) };
}

function chebyshevPoles(order: number, epsilon: number): Complex[] {
  const a = Math.asinh(1 / epsilon) / order;
  return Array.from({ length: order }, (_, k) => {
    const theta = (Math.PI * (2 * k + 1)) / (2 * order);
    return c(-Math.sinh(a) * Math.sin(theta), Math.cosh(a) * Math.cos(theta));
  });
}

function chebyshev2(order: number, stopband: number): Prototype {
  const epsilon = 1 / Math.sqrt(10 ** (stopband / 10) - 1);
  const zeros: Complex[] = [];
  for (let k = 0; k < order; k++) {
    const cosine = Math.cos((Math.PI * (2 * k + 1)) / (2 * order));
    if (Math.abs(cosine) > 1e-9) zeros.push(c(0, 1 / cosine));
  }
  return { zeros, poles: chebyshevPoles(order, epsilon).map((p) => div(c(1), p)) };
}

function bessel(order: number): Prototype {
  const factorial = (n: number): number => (n < 2 ? 1 : n * factorial(n - 1));
  const coefficients = Array.from({ length: order + 1 }, (_, i) => {
    const k = order - i;
    return factorial(2 * order - k) / (2 ** (order - k) * factorial(k) * factorial(order - k));
  });
  const raw = roots(coefficients);
  // Scale the poles so the gain is 3 dB down at 1, as for the other families.
  const gain = (w: number) => coefficients[order] / abs(polyval(coefficients, c(0, w)));
  let low = 0.01;
  let high = 100;
  for (let i = 0; i < 80; i++) {
    const middle = Math.sqrt(low * high);
    if (gain(middle) > Math.SQRT1_2) low = middle;
    else high = middle;
  }
  return { zeros: [], poles: raw.map((p) => scale(p, 1 / low)) };
}

/** Descending Landen transformation of the modulus, for the elliptic functions below. */
function landen(k: number): number[] {
  const list: number[] = [];
  let value = k;
  for (let i = 0; i < 8; i++) {
    const next = value / (1 + Math.sqrt(1 - value * value));
    value = next * next;
    list.push(value);
    if (value < 1e-15) break;
  }
  return list;
}

function raise(w: Complex, v: number[]): Complex {
  let result = w;
  for (let i = v.length - 1; i >= 0; i--) result = div(scale(result, 1 + v[i]), add(c(1), scale(mul(result, result), v[i])));
  return result;
}

/** Jacobi cd(uK, k) and sn(uK, k), with complex u. */
const cde = (u: Complex, k: number) => raise(cos(scale(u, Math.PI / 2)), landen(k));
const sne = (u: Complex, k: number) => raise(sin(scale(u, Math.PI / 2)), landen(k));

function cos(z: Complex): Complex {
  return c(Math.cos(z.re) * Math.cosh(z.im), -Math.sin(z.re) * Math.sinh(z.im));
}

function sin(z: Complex): Complex {
  return c(Math.sin(z.re) * Math.cosh(z.im), Math.cos(z.re) * Math.sinh(z.im));
}

/** Inverse of sne. */
function asne(w: Complex, k: number): Complex {
  const v = landen(k);
  let value = w;
  let previous = k;
  for (const next of v) {
    const root = sqrt(sub(c(1), scale(mul(value, value), previous * previous)));
    value = scale(div(value, add(c(1), root)), 2 / (1 + next));
    previous = next;
  }
  return sub(c(1), scale(acos(value), 2 / Math.PI));
}

/** Elliptic design for a fixed order, after S. J. Orfanidis, Lecture Notes on Elliptic Filter Design. */
function elliptic(order: number, ripple: number, stopband: number): Prototype {
  const ep = Math.sqrt(10 ** (ripple / 10) - 1);
  const es = Math.sqrt(10 ** (stopband / 10) - 1);
  const k1 = ep / es;
  const pairs = Math.floor(order / 2);
  const odd = order % 2 === 1;
  const positions = Array.from({ length: pairs }, (_, i) => (2 * i + 1) / order);
  const k1Dual = Math.sqrt(1 - k1 * k1);
  const product = positions.reduce((total, u) => total * sne(c(u), k1Dual).re, 1);
  const kDual = k1Dual ** order * product ** 4;
  const k = Math.sqrt(1 - kDual * kDual);
  const v0 = mul(c(0, -1 / order), asne(c(0, 1 / ep), k1));
  const poles: Complex[] = [];
  const zeros: Complex[] = [];
  for (const u of positions) {
    const zero = div(J, scale(cde(c(u), k), k));
    const pole = mul(J, cde(sub(c(u), mul(J, v0)), k));
    zeros.push(zero, c(zero.re, -zero.im));
    poles.push(pole, c(pole.re, -pole.im));
  }
  if (odd) poles.push(mul(J, sne(mul(J, v0), k)));
  return { poles, zeros };
}

function prototype({ family, order, ripple, stopband }: Design): Prototype {
  switch (family) {
    case 'butterworth': return butterworth(order);
    case 'chebyshev1': return { zeros: [], poles: chebyshevPoles(order, Math.sqrt(10 ** (ripple / 10) - 1)) };
    case 'chebyshev2': return chebyshev2(order, stopband);
    case 'elliptic': return order < 2 ? butterworth(1) : elliptic(order, ripple, stopband);
    case 'bessel': return bessel(order);
    case 'linkwitz': {
      // Two Butterworth filters of half the order in series.
      const half = butterworth(Math.ceil(order / 2)).poles;
      return { zeros: [], poles: [...half, ...half] };
    }
  }
}

const warp = (frequency: number) => Math.tan(Math.PI * frequency);
const bilinear = (s: Complex) => div(add(c(1), s), sub(c(1), s));

/** The two roots of s² - bs + w². */
function pair(b: Complex, w2: number): [Complex, Complex] {
  const half = scale(b, 0.5);
  const root = sqrt(sub(mul(half, half), c(w2)));
  return [add(half, root), sub(half, root)];
}

/** Maps a prototype to the target response, and into the Z plane. */
function transform({ response, cutoff, width }: Design, { poles, zeros }: Prototype): Prototype {
  const extra = poles.length - zeros.length;
  const flat = (fn: (a: Complex) => Complex[], list: Complex[]) => list.flatMap(fn).map(bilinear);
  const fill = (count: number, value: number) => Array.from({ length: count }, () => c(value));
  if (response === 'lowpass' || response === 'highpass') {
    const w = warp(cutoff);
    const map = response === 'lowpass' ? (a: Complex) => [scale(a, w)] : (a: Complex) => [div(c(w), a)];
    return { poles: flat(map, poles), zeros: [...flat(map, zeros), ...fill(extra, response === 'lowpass' ? -1 : 1)] };
  }
  const low = Math.max(0.0005, cutoff - width / 2);
  const high = Math.min(0.4995, cutoff + width / 2);
  const w1 = warp(low);
  const w2 = warp(high);
  const w0 = w1 * w2;
  const band = w2 - w1;
  if (response === 'bandpass') {
    const map = (a: Complex) => pair(scale(a, band), w0);
    return { poles: flat(map, poles), zeros: [...flat(map, zeros), ...fill(extra, 1), ...fill(extra, -1)] };
  }
  const map = (a: Complex) => pair(div(c(band), a), w0);
  const centre = bilinear(c(0, Math.sqrt(w0)));
  const notches = Array.from({ length: extra }, () => [centre, c(centre.re, -centre.im)]).flat();
  return { poles: flat(map, poles), zeros: [...flat(map, zeros), ...notches] };
}

const TINY = 1e-9;

/** Quadratics in z, from roots, keeping each conjugate pair together. */
function quadratics(list: Complex[]): [number, number, number][] {
  const upper = list.filter((z) => z.im > TINY);
  const reals = list.filter((z) => Math.abs(z.im) <= TINY).map((z) => z.re);
  const groups: [number, number, number][] = upper
    .sort((p, q) => abs(q) - abs(p))
    .map((z) => [1, -2 * z.re, z.re * z.re + z.im * z.im]);
  for (let i = 0; i < reals.length; i += 2) {
    const a = reals[i];
    const b = reals[i + 1];
    groups.push(b === undefined ? [1, -a, 0] : [1, -(a + b), a * b]);
  }
  return groups;
}

export function response(sections: Section[], frequency: number): Complex {
  const w = 2 * Math.PI * frequency;
  const z = c(Math.cos(w), Math.sin(w));
  return sections.reduce((total, { b, a }) => mul(total, div(polyval(b, z), polyval(a, z))), c(1));
}

export const gain = (sections: Section[], frequency: number) => abs(response(sections, frequency));

/** Scales the first section so the loudest frequency has a gain of 1. */
export function normalise(sections: Section[]): Section[] {
  if (!sections.length) return sections;
  let peak = 0;
  for (let i = 0; i <= 2000; i++) peak = Math.max(peak, gain(sections, i / 4000));
  const factor = peak > 0 ? 1 / peak : 1;
  const [first, ...rest] = sections;
  return [{ ...first, b: first.b.map((value) => value * factor) as Section['b'] }, ...rest];
}

export function design(settings: Design): Section[] {
  const digital = transform(settings, prototype(settings));
  const poles = quadratics(digital.poles);
  const zeros = quadratics(digital.zeros);
  return normalise(poles.map((a, i) => ({ a, b: zeros[i] ?? [1, 0, 0] })));
}

export const orderOf = (sections: Section[]) => sections.reduce((total, { a }) => total + (a[2] === 0 ? 1 : 2), 0);
export const polesOf = (sections: Section[]) => sections.flatMap(({ a }) => roots(a)).filter((z) => abs(z) > TINY);
export const zerosOf = (sections: Section[]) => sections.flatMap(({ b }) => roots(b)).filter((z) => abs(z) > TINY);
