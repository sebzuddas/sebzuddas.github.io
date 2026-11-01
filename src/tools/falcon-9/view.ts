import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import { createRng } from '../../lib/instrument/rng';
import { Recorder } from '../../lib/instrument/recorder';
import { fit, runFrames, type Mount } from '../../lib/instrument/runtime';
import { Stepper } from '../../lib/instrument/stepper';
import { DT, FUEL, MPC_N, PAD_RADIUS, Falcon9, type Mode, type Outcome } from './model';
import { legWireframe, shipWireframe, terrainWireframe } from './ship';

const SAMPLE_EVERY = 10;
const DEMO_PAUSE = 4;
const STATUS: Record<Outcome, string> = {
  landed: 'Landed',
  hard: 'Hard landing',
  tipped: 'Tipped over',
  missed: 'Missed the pad',
};
type Axis = 'lateral' | 'vertical' | 'depth';
const KEYS: Record<string, [Axis, number]> = {
  KeyA: ['lateral', -1], ArrowLeft: ['lateral', -1],
  KeyD: ['lateral', 1], ArrowRight: ['lateral', 1],
  KeyW: ['vertical', 1], KeyS: ['vertical', -1],
  ArrowUp: ['depth', 1], ArrowDown: ['depth', -1],
};
/** What each axis direction does in each mode, shown on the keys. */
const ACTIONS: Record<Mode, Record<string, string>> = {
  manual: { 'vertical1': 'Throttle up', 'vertical-1': 'Throttle down', 'lateral-1': 'Steer left', 'lateral1': 'Steer right', 'depth1': 'Steer away', 'depth-1': 'Steer back' },
  assist: { 'vertical1': 'Descend slower', 'vertical-1': 'Descend faster', 'lateral-1': 'Go left', 'lateral1': 'Go right', 'depth1': 'Go away', 'depth-1': 'Go back' },
  auto: { 'vertical1': 'Autopilot', 'vertical-1': 'Autopilot', 'lateral-1': 'Autopilot', 'lateral1': 'Autopilot', 'depth1': 'Autopilot', 'depth-1': 'Autopilot' },
};

function lines(positions: Float32Array, color: Color, opacity = 1) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return new LineSegments(geometry, new LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

export const mount: Mount = (ctx) => {
  const { state, root, screen, recorder: strip, meta } = ctx;
  const renderer = new WebGLRenderer({ canvas: screen, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.autoClear = false;
  screen.style.filter = `drop-shadow(0 0 2px ${ctx.token('--screen-ink')})`;

  const bright = new Color(ctx.token('--screen-accent'));
  const ink = new Color(ctx.token('--screen-ink'));
  const dim = new Color(ctx.token('--screen-dim'));
  const alert = new Color(ctx.token('--screen-alert'));
  const background = new Color(ctx.token('--screen-bg'));

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 16 / 10, 1, 9000);
  const terrain = terrainWireframe(createRng(1983), PAD_RADIUS);
  scene.add(lines(terrain.ground, dim, 0.7), lines(terrain.near, dim, 0.7), lines(terrain.hills, ink, 0.8), lines(terrain.pad, bright));

  const wire = shipWireframe();
  const ship = new Group();
  const hull = lines(wire.slice(), bright);
  const legPositions = legWireframe(0);
  const legs = lines(legPositions, bright);
  hull.rotation.y = legs.rotation.y = 0.5;
  ship.add(hull, legs);
  const flame = lines(new Float32Array([
    -1.6, 0, 0, 0, -1, 0, 1.6, 0, 0, 0, -1, 0, 0, 0, 1.6, 0, -1, 0, 0, 0, -1.6, 0, -1, 0,
    -0.8, 0, 0.8, 0, -0.7, 0, 0.8, 0, -0.8, 0, -0.7, 0,
  ]), alert);
  flame.position.y = 1.4;
  ship.add(flame);
  scene.add(ship);

  // A ring on the ground under the ship and a line down to it, which is what makes 3D flyable.
  const circle: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const b = ((i + 1) / 20) * Math.PI * 2;
    circle.push(9 * Math.cos(a), 0.4, 9 * Math.sin(a), 9 * Math.cos(b), 0.4, 9 * Math.sin(b));
  }
  const marker = lines(new Float32Array(circle), alert);
  scene.add(marker);
  const dropPositions = new Float32Array(6);
  const drop = lines(dropPositions, dim, 0.8);
  drop.frustumCulled = false;
  scene.add(drop);

  // The controller's live prediction, drawn as a dashed path.
  const planPositions = new Float32Array(MPC_N * 6);
  const plan = lines(planPositions, alert);
  plan.frustumCulled = false;
  scene.add(plan);

  // Phosphor persistence: fade the last frame rather than clearing it.
  const fadeScene = new Scene();
  const fade = new Mesh(
    new PlaneGeometry(2, 2),
    new MeshBasicMaterial({ color: background, transparent: true, opacity: 0.42, depthTest: false }),
  );
  fadeScene.add(fade);
  const fadeCamera = new Camera();

  const recorder = new Recorder(meta.channels!, 150);
  const held = { lateral: 0, vertical: 0, depth: 0 };
  const keysDown = new Set<string>();
  const keyButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-key]')];

  let rocket: Falcon9;
  let seed = state.x as number;
  let pause = 0;
  let debris: Float32Array | null = null;
  let debrisVelocity: Float32Array;
  const stepper = new Stepper(DT, advance);

  let drawnLegs = 0;

  function launch() {
    rocket = new Falcon9(state.m as Mode, seed);
    keysDown.clear();
    readInput();
    recorder.clear();
    pause = 0;
    if (debris) {
      hull.geometry.setAttribute('position', new BufferAttribute(wire.slice(), 3));
      debris = null;
    }
    legs.visible = true;
    showLegs();
  }

  function showLegs() {
    if (rocket.legs === drawnLegs) return;
    drawnLegs = rocket.legs;
    legPositions.set(legWireframe(drawnLegs));
    legs.geometry.getAttribute('position').needsUpdate = true;
  }

  function readInput() {
    held.lateral = 0;
    held.vertical = 0;
    held.depth = 0;
    for (const code of keysDown) {
      const binding = KEYS[code];
      if (binding) held[binding[0]] = binding[1];
    }
    for (const button of keyButtons) {
      const on = button.dataset.key!.split(' ').some((code) => keysDown.has(code));
      button.classList.toggle('pressed', on);
    }
  }

  /** Shows what each key does right now. */
  function labelKeys() {
    const mode = state.m as Mode;
    root.querySelectorAll<HTMLElement>('[data-pad]').forEach((pad) => pad.classList.toggle('idle', mode === 'auto'));
    for (const button of keyButtons) {
      const binding = KEYS[button.dataset.key!.split(' ')[0]];
      const does = button.querySelector('[data-does]');
      if (!binding || !does) continue;
      does.textContent = ACTIONS[mode][`${binding[0]}${binding[1]}`];
      button.setAttribute('aria-label', `${button.querySelector('.cap')!.textContent}: ${does.textContent}`);
    }
  }

  function advance() {
    const wasFlying = !rocket.outcome;
    rocket.step(held);
    if (rocket.tick % SAMPLE_EVERY === 0 && wasFlying) recorder.push([-rocket.vz, rocket.throttle]);
    if (wasFlying && rocket.outcome && rocket.outcome !== 'landed') explode();
    if (rocket.outcome) {
      pause += DT;
      if (rocket.mode === 'auto' && pause > DEMO_PAUSE) {
        seed++;
        launch();
      }
    }
    updateDebris();
  }

  function explode() {
    const leg = legWireframe(rocket.legs);
    debris = new Float32Array(wire.length + leg.length);
    debris.set(wire);
    debris.set(leg, wire.length);
    legs.visible = false;
    const rand = createRng(rocket.tick);
    debrisVelocity = new Float32Array(debris.length);
    for (let i = 0; i < debris.length; i += 6) {
      const vx = (rand() - 0.5) * 40;
      const vy = rand() * 34;
      const vz = (rand() - 0.5) * 40;
      for (let k = 0; k < 6; k += 3) {
        debrisVelocity[i + k] = vx;
        debrisVelocity[i + k + 1] = vy;
        debrisVelocity[i + k + 2] = vz;
      }
    }
    hull.geometry.setAttribute('position', new BufferAttribute(debris, 3));
  }

  function updateDebris() {
    if (!debris) return;
    const attribute = hull.geometry.getAttribute('position');
    for (let i = 0; i < debris.length; i += 3) {
      debrisVelocity[i + 1] -= 9.81 * DT;
      debris[i] += debrisVelocity[i] * DT;
      debris[i + 1] = Math.max(0, debris[i + 1] + debrisVelocity[i + 1] * DT);
      debris[i + 2] += debrisVelocity[i + 2] * DT;
    }
    attribute.needsUpdate = true;
  }

  function resize() {
    const { width, height } = screen.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  function draw() {
    const { x, y, z, theta, phi, throttle } = rocket;
    // World z points at the camera, so "away" is negative.
    ship.position.set(x, z, -y);
    ship.rotation.set(-phi, 0, -theta);
    marker.position.set(x, 0, -y);
    dropPositions.set([x, z, -y, x, 0, -y]);
    drop.geometry.getAttribute('position').needsUpdate = true;
    showLegs();

    flame.visible = throttle > 0 && !rocket.outcome;
    flame.scale.set(1, 10 + 34 * throttle * (0.82 + 0.18 * Math.sin(rocket.tick * 1.9)), 1);
    flame.rotation.set(rocket.gimbalPhi, 0, rocket.gimbal);

    const flying = rocket.mode !== 'manual' && !rocket.outcome && rocket.tick > 0;
    plan.visible = flying;
    if (flying) {
      for (let k = 0; k < MPC_N; k++) {
        // Every other segment is left empty, which makes the line dashed.
        const b = k % 2 ? k : Math.min(k + 1, MPC_N - 1);
        planPositions.set([
          rocket.planX[k], Math.max(rocket.planZ[k], 0), -rocket.planY[k],
          rocket.planX[b], Math.max(rocket.planZ[b], 0), -rocket.planY[b],
        ], k * 6);
      }
      plan.geometry.getAttribute('position').needsUpdate = true;
    }

    // Keep both the whole ship and the pad in frame on the way down.
    const distance = Math.max(130, z * 1.5);
    const lookY = Math.max(30, z * 0.62, z + 62 - 0.37 * distance);
    camera.position.set(x * 0.55 + 70, lookY + distance * 0.34, distance - y * 0.55);
    camera.lookAt(x * 0.55, lookY, -y * 0.55);

    renderer.clearDepth();
    renderer.render(fadeScene, fadeCamera);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  function showReadouts() {
    const status = rocket.outcome ? STATUS[rocket.outcome] : rocket.legs === 1 ? 'Legs locked' : rocket.legs > 0 ? 'Legs deploying' : 'Descending';
    ctx.setReadout('st', status);
    ctx.setReadout('alt', rocket.z.toFixed(0));
    ctx.setReadout('vz', rocket.vz.toFixed(1));
    ctx.setReadout('vx', rocket.vx.toFixed(1));
    ctx.setReadout('vy', rocket.vy.toFixed(1));
    ctx.setReadout('tilt', ((Math.hypot(rocket.theta, rocket.phi) * 180) / Math.PI).toFixed(1));
    ctx.setReadout('thr', (rocket.throttle * 100).toFixed(0));
    ctx.setReadout('fuel', ((rocket.fuel / FUEL) * 100).toFixed(0));
    ctx.setReadout('t', (rocket.tick * DT).toFixed(1));
    ctx.setLamp(rocket.mode !== 'manual');
  }

  function drawAll() {
    draw();
    if (strip) {
      fit(strip);
      recorder.draw(strip, ctx.token);
    }
    showReadouts();
  }

  function fly() {
    labelKeys();
    launch();
    startLoop();
  }

  /** Without motion: a truthful frame from partway down an autopilot descent. */
  function staticFrame() {
    while (!rocket.outcome && rocket.z > 260) advance();
    stopLoop?.();
    stopLoop = null;
    fade.material.opacity = 1;
    drawAll();
  }

  const down = (event: KeyboardEvent) => {
    if (rocket.mode === 'auto' || rocket.outcome || !(event.code in KEYS)) return;
    if ((event.target as HTMLElement).matches?.('input, select, textarea')) (event.target as HTMLElement).blur();
    event.preventDefault();
    keysDown.add(event.code);
    readInput();
  };
  const up = (event: KeyboardEvent) => {
    keysDown.delete(event.code);
    readInput();
  };
  addEventListener('keydown', down);
  addEventListener('keyup', up);

  ctx.onAction(fly);
  ctx.onChange(fly);
  for (const button of keyButtons) {
    const code = button.dataset.key!.split(' ')[0];
    const release = () => {
      keysDown.delete(code);
      readInput();
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (rocket.mode === 'auto' || rocket.outcome) return;
      keysDown.add(code);
      readInput();
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (ctx.reduced && !stopLoop) drawAll();
  });
  observer.observe(screen);

  let stopLoop: (() => void) | null = null;
  function startLoop() {
    if (stopLoop) return;
    fade.material.opacity = 0.42;
    stopLoop = runFrames(root, (elapsed) => {
      stepper.advance(elapsed);
      drawAll();
    });
  }

  resize();
  renderer.setClearColor(background, 1);
  renderer.clear();
  labelKeys();
  launch();
  if (ctx.reduced) staticFrame();
  else startLoop();

  return () => {
    stopLoop?.();
    observer.disconnect();
    removeEventListener('keydown', down);
    removeEventListener('keyup', up);
    renderer.dispose();
  };
};
