export interface Params {
  zeta: number;
  wn: number;
}

/** Unit step response of wn²/(s² + 2ζwn s + wn²), closed form. */
export function response({ zeta, wn }: Params, t: number): number {
  if (t <= 0) return 0;
  if (Math.abs(zeta - 1) < 1e-6) return 1 - (1 + wn * t) * Math.exp(-wn * t);
  if (zeta < 1) {
    const wd = wn * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + (zeta * wn * Math.sin(wd * t)) / wd);
  }
  const root = Math.sqrt(zeta * zeta - 1);
  const s1 = -wn * (zeta - root);
  const s2 = -wn * (zeta + root);
  return 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
}

/** First time the response reaches a level, for monotonic rises to it. */
function crossing(p: Params, level: number, end: number): number {
  const steps = 4000;
  let before = 0;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * end;
    if (response(p, t) >= level) {
      let lo = before;
      let hi = t;
      for (let b = 0; b < 50; b++) {
        const mid = (lo + hi) / 2;
        if (response(p, mid) >= level) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    before = t;
  }
  return end;
}

export function horizon({ zeta, wn }: Params): number {
  const decay = zeta < 1 ? zeta * wn : wn * (zeta - Math.sqrt(zeta * zeta - 1));
  return 8 / Math.max(decay, 1e-3);
}

export function metrics(p: Params) {
  const { zeta, wn } = p;
  const end = horizon(p);
  const under = zeta < 1;
  const overshoot = under ? 100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) : 0;
  const peakTime = under ? Math.PI / (wn * Math.sqrt(1 - zeta * zeta)) : Infinity;
  const rise = crossing(p, 0.9, end) - crossing(p, 0.1, end);

  // Last moment outside the 2% band, scanning back from the horizon.
  const steps = 20000;
  let settle = 0;
  for (let i = steps; i >= 0; i--) {
    const t = (i / steps) * end;
    if (Math.abs(response(p, t) - 1) > 0.02) {
      settle = t;
      break;
    }
  }
  return { overshoot, peakTime, rise, settle };
}
