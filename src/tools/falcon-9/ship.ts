export type Segments = number[];

const RADIUS = 2.1;
/** Top of the engine section. The feet reach y = 0 when the legs are out. */
const BASE = 3;
/** The tank ends here and the wider-looking interstage starts. */
const INTERSTAGE = 38;
const TOP = 47;
const SIDES = 12;
const ENGINE_RING = 1.45;

const LEG_HINGE = BASE + 1;
const LEG_FOOT_RADIUS = 11.5;
const LEG_STRUT = 14;

function ring(out: Segments, y: number, r: number, sides = SIDES) {
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const b = ((i + 1) / sides) * Math.PI * 2;
    out.push(r * Math.cos(a), y, r * Math.sin(a), r * Math.cos(b), y, r * Math.sin(b));
  }
}

/** One Merlin bell, hanging under the octaweb. */
function engine(out: Segments, x: number, z: number) {
  const throat = 0.16;
  const mouth = 0.42;
  const bottom = BASE - 1.6;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const b = ((k + 1) / 6) * Math.PI * 2;
    out.push(x + throat * Math.cos(a), BASE, z + throat * Math.sin(a), x + mouth * Math.cos(a), bottom, z + mouth * Math.sin(a));
    out.push(x + mouth * Math.cos(a), bottom, z + mouth * Math.sin(a), x + mouth * Math.cos(b), bottom, z + mouth * Math.sin(b));
  }
}

/** A grid fin: a lattice held out from the hull in the plane through the axis. */
function gridFin(out: Segments, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const inner = RADIUS + 0.3;
  const outer = RADIUS + 3;
  const low = TOP - 6;
  const high = TOP - 2.5;
  const at = (r: number, y: number) => [r * c, y, r * s];
  const cells = 3;
  for (let i = 0; i <= cells; i++) {
    const r = inner + ((outer - inner) * i) / cells;
    out.push(...at(r, low), ...at(r, high));
    const y = low + ((high - low) * i) / cells;
    out.push(...at(inner, y), ...at(outer, y));
  }
  out.push(...at(RADIUS, low + 1), ...at(inner, low + 1), ...at(RADIUS, high - 1), ...at(inner, high - 1));
}

/** The booster without its legs, as line segment pairs, feet on the ground at y = 0. */
export function shipWireframe(): Float32Array {
  const out: Segments = [];
  const heights = [BASE, 9, 16, 23, 30, INTERSTAGE, 41, TOP];
  for (const y of heights) ring(out, y, RADIUS);
  // A doubled ring reads as the seam where the second stage used to sit.
  ring(out, TOP - 0.5, RADIUS);
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2;
    out.push(RADIUS * Math.cos(a), BASE, RADIUS * Math.sin(a), RADIUS * Math.cos(a), TOP, RADIUS * Math.sin(a));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    gridFin(out, a);
    out.push(0, TOP, 0, RADIUS * Math.cos(a), TOP, RADIUS * Math.sin(a));
  }
  engine(out, 0, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    engine(out, ENGINE_RING * Math.cos(a), ENGINE_RING * Math.sin(a));
  }
  return new Float32Array(out);
}

/**
 * The four legs at a deployment from 0 to 1. Stowed they lie up the hull. Out,
 * each foot is on the ground, and the strut stretches to follow the leg.
 */
export function legWireframe(deployment: number): Float32Array {
  const out: Segments = [];
  const reach = LEG_FOOT_RADIUS - RADIUS;
  const length = Math.hypot(reach, LEG_HINGE);
  const lockedOut = Math.atan2(-LEG_HINGE, reach);
  const stowed = Math.PI / 2 - 0.02;
  const eased = 1 - (1 - deployment) ** 3;
  const angle = stowed + (lockedOut - stowed) * eased;
  const legWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Radial plane to world, with sideways offset for the leg's width.
    const at = (r: number, y: number, side = 0) => [r * c - side * s, y, r * s + side * c];
    const tipR = RADIUS + length * Math.cos(angle);
    const tipY = LEG_HINGE + length * Math.sin(angle);
    const midR = RADIUS + 0.55 * length * Math.cos(angle);
    const midY = LEG_HINGE + 0.55 * length * Math.sin(angle);
    out.push(...at(RADIUS, LEG_HINGE, -legWidth), ...at(tipR, tipY), ...at(RADIUS, LEG_HINGE, legWidth), ...at(tipR, tipY));
    out.push(...at(midR, midY, -legWidth * 0.45), ...at(midR, midY, legWidth * 0.45));
    out.push(...at(RADIUS, LEG_STRUT), ...at(midR, midY));
    out.push(...at(tipR - 0.5, tipY), ...at(tipR + 0.5, tipY));
  }
  return new Float32Array(out);
}

/** Vector landscape: receding grid, pad rings and a broken horizon. */
export function terrainWireframe(rand: () => number, padRadius: number): { ground: Float32Array; near: Float32Array; pad: Float32Array; hills: Float32Array } {
  const ground: Segments = [];
  const span = 3000;
  const step = 150;
  for (let v = -span; v <= span; v += step) {
    ground.push(v, 0, -span, v, 0, 400);
  }
  for (let z = -span; z <= 400; z += step) {
    ground.push(-span, 0, z, span, 0, z);
  }

  const near: Segments = [];
  for (let v = -750; v <= 750; v += 50) {
    near.push(v, 0, -750, v, 0, 400);
  }
  for (let z = -750; z <= 400; z += 50) {
    near.push(-750, 0, z, 750, 0, z);
  }

  const pad: Segments = [];
  ring(pad, 0.2, padRadius, 32);
  ring(pad, 0.2, padRadius * 0.55, 24);
  pad.push(-padRadius, 0.2, 0, padRadius, 0.2, 0, 0, 0.2, -padRadius, 0, 0.2, padRadius);

  const hills: Segments = [];
  let x = -span;
  let y = 0;
  const far = -span;
  while (x < span) {
    const nx = x + 90 + rand() * 170;
    const ny = Math.max(0, (rand() < 0.5 ? 0 : 60) + rand() * 240);
    hills.push(x, y, far, nx, ny, far);
    if (ny > 0) hills.push(nx, ny, far, nx + 40, 0, far + 180);
    x = nx;
    y = ny;
  }
  return { ground: new Float32Array(ground), near: new Float32Array(near), pad: new Float32Array(pad), hills: new Float32Array(hills) };
}
