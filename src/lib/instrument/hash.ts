import type { ParamDef, ToolState } from '../../tools/types';

export function defaults(params: ParamDef[]): ToolState {
  return Object.fromEntries(params.map((p) => [p.key, p.value]));
}

export function encode(params: ParamDef[], state: ToolState): string {
  return params
    .map((p) => {
      const v = state[p.key];
      if (p.kind === 'switch') return `${p.key}=${v ? 1 : 0}`;
      if (p.kind === 'number') return `${p.key}=${(v as number).toFixed(p.decimals)}`;
      return `${p.key}=${encodeURIComponent(String(v))}`;
    })
    .join('&');
}

/** Reads a hash, ignoring unknown keys and anything out of range. */
export function decode(params: ParamDef[], hash: string): ToolState {
  const state = defaults(params);
  const found = new URLSearchParams(hash.replace(/^#/, ''));
  for (const p of params) {
    const raw = found.get(p.key);
    if (raw === null) continue;
    if (p.kind === 'switch') {
      if (raw === '0' || raw === '1') state[p.key] = raw === '1';
    } else if (p.kind === 'choice') {
      if (p.options.some((o) => o.value === raw)) state[p.key] = raw;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      state[p.key] = p.kind === 'number' ? Math.min(p.max, Math.max(p.min, n)) : n;
    }
  }
  return state;
}
