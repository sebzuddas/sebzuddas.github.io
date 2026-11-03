/**
 * A small parser for formulas in t. Formulas arrive through shared links, so
 * nothing here reaches eval: only the names below can be called.
 */
export const MAX_LENGTH = 120;
const MAX_DEPTH = 32;

type Fn = (t: number) => number;
export type Formula = { ok: true; fn: Fn } | { ok: false; reason: string };

const constants: Record<string, number> = { pi: Math.PI, e: Math.E };
const unary: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, log: Math.log, sqrt: Math.sqrt, abs: Math.abs, sign: Math.sign,
  step: (x) => (x >= 0 ? 1 : 0),
  rect: (x) => (Math.abs(x) <= 0.5 ? 1 : 0),
};
const binary: Record<string, (a: number, b: number) => number> = { min: Math.min, max: Math.max };

const hasOwn = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);

export function parseFormula(source: string): Formula {
  if (source.length > MAX_LENGTH) return { ok: false, reason: `Formulas are limited to ${MAX_LENGTH} characters` };
  const tokens = source.match(/\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+|[a-zA-Z]+|[-+*/^(),]|\S/g) ?? [];
  let at = 0;
  let depth = 0;
  const fail = (reason: string): never => {
    throw new Error(reason);
  };
  const eat = (token: string) => {
    if (tokens[at] !== token) fail(`Expected ${token}`);
    at++;
  };

  function expression(): Fn {
    if (++depth > MAX_DEPTH) fail('Formula is too deeply nested');
    let left = term();
    while (tokens[at] === '+' || tokens[at] === '-') {
      const op = tokens[at++];
      const a = left;
      const b = term();
      left = op === '+' ? (t) => a(t) + b(t) : (t) => a(t) - b(t);
    }
    depth--;
    return left;
  }

  function term(): Fn {
    let left = signed();
    while (tokens[at] === '*' || tokens[at] === '/') {
      const op = tokens[at++];
      const a = left;
      const b = signed();
      left = op === '*' ? (t) => a(t) * b(t) : (t) => a(t) / b(t);
    }
    return left;
  }

  function signed(): Fn {
    if (tokens[at] === '-') {
      at++;
      const inner = signed();
      return (t) => -inner(t);
    }
    if (tokens[at] === '+') at++;
    return power();
  }

  function power(): Fn {
    const base = atom();
    if (tokens[at] !== '^') return base;
    at++;
    const exponent = signed();
    return (t) => base(t) ** exponent(t);
  }

  function atom(): Fn {
    const token = tokens[at];
    if (token === undefined) return fail('The formula is unfinished');
    if (token === '(') {
      at++;
      const inner = expression();
      eat(')');
      return inner;
    }
    if (/^[\d.]/.test(token)) {
      at++;
      const value = Number(token);
      return () => value;
    }
    if (!/^[a-zA-Z]/.test(token)) return fail(`Unexpected ${token}`);
    at++;
    if (token === 't') return (t) => t;
    if (hasOwn(constants, token)) {
      const value = constants[token];
      return () => value;
    }
    if (hasOwn(unary, token)) {
      const fn = unary[token];
      eat('(');
      const a = expression();
      eat(')');
      return (t) => fn(a(t));
    }
    if (hasOwn(binary, token)) {
      const fn = binary[token];
      eat('(');
      const a = expression();
      eat(',');
      const b = expression();
      eat(')');
      return (t) => fn(a(t), b(t));
    }
    return fail(`Unknown name ${token}`);
  }

  try {
    if (!tokens.length) fail('The formula is empty');
    const fn = expression();
    if (at < tokens.length) fail(`Unexpected ${tokens[at]}`);
    return { ok: true, fn: (t) => {
      const value = fn(t);
      return Number.isFinite(value) ? value : 0;
    } };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
}
