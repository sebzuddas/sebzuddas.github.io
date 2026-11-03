import type { ParamDef, ToolMeta, ToolState } from '../../tools/types';
import { dropdown } from './dropdown';
import { decode, encode } from './hash';

export interface ToolContext {
  root: HTMLElement;
  meta: ToolMeta;
  state: ToolState;
  reduced: boolean;
  screen: HTMLCanvasElement;
  recorder: HTMLCanvasElement | null;
  /** Called whenever state changes: with the control's key, 'preset', or null for the hash and set(). */
  onChange(fn: (key: string | null) => void): void;
  /** Sets values from the view, as a control would, for tools that edit by pointer. */
  set(values: ToolState): void;
  onAction(fn: (key: string) => void): void;
  /** Tokens changed, so colours must be read again. */
  onRetheme(fn: () => void): void;
  setReadout(key: string, text: string): void;
  setLamp(on: boolean): void;
  /** CSS token from the panel's material. */
  token(name: string): string;
}

export type Mount = (ctx: ToolContext) => () => void;


export function createContext(root: HTMLElement, meta: ToolMeta): ToolContext {
  const owned = root.dataset.permalink !== undefined;
  const state = decode(meta.params, owned ? location.hash : '');
  const change: ((key: string | null) => void)[] = [];
  const action: ((key: string) => void)[] = [];
  const retheme: (() => void)[] = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let writeTimer = 0;

  const writeHash = () => {
    if (!owned) return;
    clearTimeout(writeTimer);
    writeTimer = window.setTimeout(() => {
      history.replaceState(null, '', `#${encode(meta.params, state)}`);
    }, 250);
  };

  const dropdowns = new Map<string, () => void>();

  const show = (p: ParamDef) => {
    if (p.kind === 'hidden') return;
    const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-param="${p.key}"]`);
    if (!input) return;
    if (p.kind === 'switch') (input as HTMLInputElement).checked = state[p.key] as boolean;
    else input.value = String(state[p.key]);
    dropdowns.get(p.key)?.();
    const out = root.querySelector(`[data-param-value="${p.key}"]`);
    if (out && p.kind === 'number') out.textContent = `${(state[p.key] as number).toFixed(p.decimals)}${p.unit ? ` ${p.unit}` : ''}`;
  };

  const showPreset = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b, i) => {
      const values = meta.presets?.[i]?.values ?? {};
      const on = Object.entries(values).every(([k, v]) => state[k] === v);
      b.setAttribute('aria-pressed', String(on));
    });
  };

  const changed = (key: string | null) => {
    meta.params.forEach(show);
    showPreset();
    writeHash();
    change.forEach((fn) => fn(key));
  };

  for (const p of meta.params) {
    if (p.kind === 'hidden') continue;
    const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-param="${p.key}"]`);
    if (p.kind === 'choice' && input) dropdowns.set(p.key, dropdown(input as HTMLSelectElement));
    input?.addEventListener(p.kind === 'number' || p.kind === 'text' ? 'input' : 'change', () => {
      if (p.kind === 'switch') state[p.key] = (input as HTMLInputElement).checked;
      else if (p.kind === 'number') state[p.key] = Number(input.value);
      else state[p.key] = input.value;
      changed(p.key);
    });
  }
  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button, i) => {
    button.addEventListener('click', () => {
      Object.assign(state, meta.presets?.[i]?.values);
      changed('preset');
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => action.forEach((fn) => fn(button.dataset.action!)));
  });
  root.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach((input) => {
    input.addEventListener('change', () => action.forEach((fn) => fn(input.dataset.toggle!)));
  });
  if (owned) {
    addEventListener('hashchange', () => {
      if (location.hash.slice(1) === encode(meta.params, state)) return;
      Object.assign(state, decode(meta.params, location.hash));
      changed(null);
      // "Try this" links sit below the panel, so bring it back to show the result.
      root.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    });
  }
  new MutationObserver(() => retheme.forEach((fn) => fn())).observe(root, {
    attributes: true,
    attributeFilter: ['data-material'],
  });

  meta.params.forEach(show);
  showPreset();

  return {
    root,
    meta,
    state,
    reduced,
    screen: root.querySelector<HTMLCanvasElement>('[data-screen]')!,
    recorder: root.querySelector<HTMLCanvasElement>('[data-recorder]'),
    onChange: (fn) => void change.push(fn),
    set(values) {
      Object.assign(state, values);
      changed(null);
    },
    onAction: (fn) => void action.push(fn),
    onRetheme: (fn) => void retheme.push(fn),
    setReadout(key, text) {
      const el = root.querySelector(`[data-readout="${key}"]`);
      if (!el || el.textContent === text) return;
      el.textContent = text;
      const ghost = root.querySelector(`[data-ghost="${key}"]`);
      if (ghost) ghost.textContent = text.replace(/[0-9-]/g, '8');
    },
    setLamp(on) {
      root.querySelector('[data-lamp]')?.classList.toggle('on', on);
    },
    token: (name) => getComputedStyle(root).getPropertyValue(name).trim(),
  };
}

/** Sizes a canvas to its box with DPR capped at 2. */
export function fit(canvas: HTMLCanvasElement) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}

/**
 * Runs a frame callback only while the instrument is on screen and the tab is
 * visible, so CPU falls to near zero otherwise.
 */
export function runFrames(root: HTMLElement, frame: (elapsed: number) => void): () => void {
  let visible = true;
  let id = 0;
  let last = 0;

  const tick = (now: number) => {
    id = 0;
    frame(last ? Math.min((now - last) / 1000, 0.25) : 0);
    last = now;
    if (running()) id = requestAnimationFrame(tick);
  };
  const running = () => visible && !document.hidden;
  const sync = () => {
    if (running() && !id) {
      last = 0;
      id = requestAnimationFrame(tick);
    }
  };
  const observer = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    sync();
  });
  observer.observe(root);
  document.addEventListener('visibilitychange', sync);
  sync();

  return () => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', sync);
    if (id) cancelAnimationFrame(id);
  };
}
