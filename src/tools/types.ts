export type Material = 'phosphor' | 'blueprint' | 'plotter';

export type ParamDef =
  | { key: string; label: string; kind: 'number'; min: number; max: number; step: number; value: number; decimals: number; unit?: string }
  | { key: string; label: string; kind: 'switch'; value: boolean }
  | { key: string; label: string; kind: 'choice'; value: string; options: { value: string; label: string }[] }
  /** Part of the permalink, not shown as a control. */
  | { key: string; kind: 'hidden'; value: number };

export interface ReadoutDef {
  key: string;
  label: string;
  unit?: string;
  /** Words rather than a number, so not shown on a seven-segment display. */
  text?: boolean;
}

/** A keyboard diagram. Keys sit in the inverted T of the real keys. */
export interface KeypadDef {
  id: string;
  keys: {
    slot: 'up' | 'left' | 'down' | 'right';
    cap: string;
    /** KeyboardEvent.code values this key answers to. */
    codes: string[];
    action: string;
  }[];
}

export interface ChannelDef {
  label: string;
  min: number;
  max: number;
}

export interface ToolMeta {
  slug: string;
  title: string;
  summary: string;
  kind: 'simulation' | 'calculator';
  material: Material;
  /** Sort position on /tools/. */
  order: number;
  /** Maker's plate, for example "Model SZ-1". */
  model: string;
  screenLabel: string;
  /** Text shown if the drawing surface cannot start. */
  fallback: string;
  params: ParamDef[];
  readouts: ReadoutDef[];
  channels?: ChannelDef[];
  presets?: { label: string; values: Record<string, number | boolean | string> }[];
  actions?: { key: string; label: string }[];
  keypads?: KeypadDef[];
  /** Lit lamp label, for tools with a loop. */
  lamp?: string;
  /** Pointer access to the screen. */
  clickable?: boolean;
  /** Hand-marked label on the panel. */
  tape?: string;
  references: { label: string; url?: string }[];
}

export type ToolState = Record<string, number | boolean | string>;
