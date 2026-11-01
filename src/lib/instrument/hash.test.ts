import { describe, expect, it } from 'vitest';
import type { ParamDef } from '../../tools/types';
import { decode, defaults, encode } from './hash';

const params: ParamDef[] = [
  { key: 'a', label: 'A', kind: 'number', min: 0, max: 1, step: 0.01, value: 0.1, decimals: 2 },
  { key: 'l', label: 'L', kind: 'switch', value: true },
  { key: 's', label: 'S', kind: 'choice', value: 'x', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
  { key: 'n', kind: 'hidden', value: 7 },
];

describe('hash codec', () => {
  it('round-trips state exactly', () => {
    const state = { a: 0.37, l: false, s: 'y', n: 42 };
    expect(decode(params, encode(params, state))).toEqual(state);
  });
  it('keeps defaults for missing keys', () => {
    expect(decode(params, '')).toEqual(defaults(params));
  });
  it('clamps and rejects bad input', () => {
    expect(decode(params, '#a=9&l=maybe&s=z&n=abc')).toEqual({ ...defaults(params), a: 1 });
  });
});
