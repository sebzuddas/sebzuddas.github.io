/** Complex arithmetic and polynomials for the tools that work in the frequency domain. Coefficients run from the highest power down. */
export interface Complex {
  re: number;
  im: number;
}

export const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const abs = (a: Complex) => Math.hypot(a.re, a.im);
export const exp = (a: Complex): Complex => ({ re: Math.exp(a.re) * Math.cos(a.im), im: Math.exp(a.re) * Math.sin(a.im) });

export function div(a: Complex, b: Complex): Complex {
  const size = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / size, im: (a.im * b.re - a.re * b.im) / size };
}

export function polyval(coefficients: number[], z: Complex): Complex {
  return coefficients.reduce<Complex>((sum, c) => add(mul(sum, z), { re: c, im: 0 }), { re: 0, im: 0 });
}

/** Drops leading coefficients that are zero, or tiny next to the largest. */
export function trim(coefficients: number[], tolerance = 0): number[] {
  const largest = Math.max(...coefficients.map(Math.abs));
  const first = coefficients.findIndex((c) => Math.abs(c) > tolerance * largest);
  return first < 0 ? [] : coefficients.slice(first);
}

/** All roots by Durand-Kerner. Near-real roots are snapped to the real line, so real polynomials give real roots and conjugate pairs. */
export function roots(coefficients: number[]): Complex[] {
  const poly = trim(coefficients);
  const found: Complex[] = [];
  while (poly.length > 1 && poly[poly.length - 1] === 0) {
    poly.pop();
    found.push({ re: 0, im: 0 });
  }
  const n = poly.length - 1;
  if (n < 1) return found;
  const monic = poly.map((c) => c / poly[0]);
  const radius = 1 + Math.max(...monic.slice(1).map(Math.abs));
  const start: Complex = { re: 0.4, im: 0.9 };
  let guess = Array.from({ length: n }, (_, k) => {
    let z: Complex = { re: radius / 2, im: 0 };
    for (let i = 0; i < k; i++) z = mul(z, start);
    return z;
  });
  for (let iteration = 0; iteration < 800; iteration++) {
    const next = guess.map((z, i) => {
      const below = guess.reduce<Complex>((product, other, j) => (i === j ? product : mul(product, sub(z, other))), { re: 1, im: 0 });
      return sub(z, div(polyval(monic, z), below));
    });
    const moved = Math.max(...next.map((z, i) => abs(sub(z, guess[i]))));
    guess = next;
    if (moved < 1e-13 * radius) break;
  }
  return [...found, ...guess.map((z) => (Math.abs(z.im) < 1e-6 * (1 + abs(z)) ? { re: z.re, im: 0 } : z))];
}

/** The monic real polynomial with these roots. They must come in conjugate pairs. */
export function fromRoots(list: Complex[]): number[] {
  let poly: Complex[] = [{ re: 1, im: 0 }];
  for (const root of list) {
    const next: Complex[] = [...poly, { re: 0, im: 0 }];
    poly.forEach((c, i) => {
      next[i + 1] = sub(next[i + 1], mul(c, root));
    });
    poly = next;
  }
  return poly.map((c) => c.re);
}

/** Radix-2 FFT, in place. The length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const w = { re: Math.cos(angle * k), im: Math.sin(angle * k) };
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * w.re - im[b] * w.im;
        const ti = re[b] * w.im + im[b] * w.re;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}
