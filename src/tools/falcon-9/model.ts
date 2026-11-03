import { createRng } from '../../lib/instrument/rng';
import { AxisMPC } from './mpc';

export const DT = 0.02;
export const G = 9.81;
export const CONTROL_EVERY = 10;
export const MPC_DT = 0.25;
export const MPC_N = 24;

/** Full-thrust acceleration at start mass, m/s². */
export const THRUST = 15.7;
export const THROTTLE_MIN = 0.4;
export const GIMBAL_MAX = 0.26;
/** Angular acceleration per unit of thrust-to-start-weight and sin(gimbal). */
export const TORQUE = 6;
export const ANGULAR_DAMPING = 0.25;
export const DRAG = 0.0008;
/** Fraction of start mass burned per second at full throttle. */
export const BURN = 0.0055;
export const FUEL = 0.3;

export const TILT_MAX = 0.35;
export const PAD_RADIUS = 20;
export const LIMITS = { vz: 3, vx: 2, tilt: 0.105 };
export const DESCENT_ACCEL = 3.2;
/** Legs start out at this height and take this long, s. */
export const LEG_ALTITUDE = 80;
export const LEG_TIME = 2;

/** Lateral MPC weights and attitude gains, frozen by sweep. */
export const TUNING = { wp: 0.06, wv: 0.6, wu: 4, wt: 4, kp: 4, kd: 4 };

export type Mode = 'manual' | 'assist' | 'auto';
export type Outcome = 'landed' | 'hard' | 'tipped' | 'missed';

export interface Input {
  /** -1 to 1 from the keyboard. */
  lateral: number;
  vertical: number;
  /** Second lateral axis. */
  depth?: number;
}

export class Falcon9 {
  x: number;
  z: number;
  vx: number;
  vz: number;
  theta: number;
  omega = 0;
  fuel = FUEL;
  throttle = 0;
  gimbal = 0;
  /** Second lateral axis: position, speed, tilt, tilt rate, gimbal. */
  y = 0;
  vy = 0;
  phi = 0;
  omegaPhi = 0;
  gimbalPhi = 0;
  /** Landing legs, 0 stowed to 1 locked out. */
  legs = 0;
  /** Thrust the pilot has set, in manual. */
  stick = 0;
  tick = 0;
  outcome: Outcome | null = null;
  readonly mode: Mode;
  /** Horizontal and vertical plans, for drawing. */
  planX = new Float64Array(MPC_N);
  planY = new Float64Array(MPC_N);
  planZ = new Float64Array(MPC_N);

  private ax = 0;
  private ay = 0;
  private az = G;
  private mpcX = new AxisMPC(MPC_N, MPC_DT, TUNING.wp, TUNING.wv, TUNING.wu, TUNING.wt);
  private mpcY = new AxisMPC(MPC_N, MPC_DT, TUNING.wp, TUNING.wv, TUNING.wu, TUNING.wt);
  private mpcZ = new AxisMPC(MPC_N, MPC_DT, 0.1, 1.2, 0.05, 6);
  private pRef = new Float64Array(MPC_N);
  private vRef = new Float64Array(MPC_N);
  private qRef = new Float64Array(MPC_N);
  private uRef = new Float64Array(MPC_N);
  private zRef = new Float64Array(MPC_N);
  private wRef = new Float64Array(MPC_N);

  constructor(mode: Mode, seed: number) {
    const rand = createRng(seed);
    this.mode = mode;
    const side = rand() < 0.5 ? -1 : 1;
    this.x = side * (90 + rand() * 120);
    this.z = 620 + rand() * 120;
    this.vx = -side * rand() * 14;
    this.vz = -(52 + rand() * 14);
    this.theta = (rand() - 0.5) * 0.14;
    const across = rand() < 0.5 ? -1 : 1;
    this.y = across * (60 + rand() * 120);
    this.vy = -across * rand() * 10;
    this.phi = (rand() - 0.5) * 0.14;
  }

  get mass() {
    return 1 - (FUEL - this.fuel);
  }

  get thrustAccel() {
    return (this.throttle * THRUST) / this.mass;
  }

  /** Commanded descent rate at an altitude: fast high up, 1.5 m/s at touchdown. */
  static descent(z: number): number {
    return -Math.min(70, Math.sqrt(2 * DESCENT_ACCEL * Math.max(z, 0) + 2.25));
  }

  private controller(input: Input) {
    const { N } = this.mpcX;
    const assist = this.mode === 'assist';
    const verticalBias = assist ? input.vertical * 12 : 0;

    let px = this.x;
    let py = this.y;
    let pz = this.z;
    let vxRefNow = 0;
    let vyRefNow = 0;
    // Sideways authority shrinks with height, so a request cannot cause a sideways landing.
    if (assist) {
      vxRefNow = input.lateral * Math.min(18, this.z * 0.06);
      vyRefNow = (input.depth ?? 0) * Math.min(18, this.z * 0.06);
    }
    for (let k = 0; k < N; k++) {
      const w = Math.min(-0.5, Falcon9.descent(pz) + verticalBias);
      pz = Math.max(0, pz + w * MPC_DT);
      this.zRef[k] = pz;
      this.wRef[k] = w;
      if (assist) {
        px += vxRefNow * MPC_DT;
        py += vyRefNow * MPC_DT;
        this.pRef[k] = px;
        this.vRef[k] = vxRefNow;
        this.qRef[k] = py;
        this.uRef[k] = vyRefNow;
      } else {
        this.pRef[k] = 0;
        this.vRef[k] = 0;
        this.qRef[k] = 0;
        this.uRef[k] = 0;
      }
    }

    const accel = THRUST / this.mass;
    const lean = Math.cos(this.theta) * Math.cos(this.phi);
    const min = accel * THROTTLE_MIN * lean - G;
    const max = accel * lean - G;
    const lateral = Math.tan(TILT_MAX) * G;
    this.az = this.mpcZ.solve(this.z, this.vz, this.zRef, this.wRef, min, max) + G;
    this.ax = this.mpcX.solve(this.x, this.vx, this.pRef, this.vRef, -lateral, lateral);
    this.mpcX.predicted(this.x, this.vx, this.planX);
    this.ay = this.mpcY.solve(this.y, this.vy, this.qRef, this.uRef, -lateral, lateral);
    this.mpcY.predicted(this.y, this.vy, this.planY);
    this.mpcZ.predicted(this.z, this.vz, this.planZ);
  }

  private attitude(accel: number, tilt: number, rate: number) {
    const low = this.z < 25;
    const command = low ? 0 : Math.max(-TILT_MAX, Math.min(TILT_MAX, Math.atan2(accel, this.az)));
    const wanted = TUNING.kp * (command - tilt) - TUNING.kd * rate;
    const authority = Math.max(0.2, this.throttle) * TORQUE;
    return Math.max(-GIMBAL_MAX, Math.min(GIMBAL_MAX, Math.asin(Math.max(-1, Math.min(1, wanted / authority)))));
  }

  step(input: Input) {
    if (this.outcome) return;
    if (this.mode === 'manual') {
      this.stick = Math.max(0, Math.min(1, this.stick + input.vertical * DT * 0.7));
      this.throttle = this.stick < THROTTLE_MIN / 2 ? 0 : Math.max(THROTTLE_MIN, this.stick);
      this.gimbal = input.lateral * GIMBAL_MAX;
      this.gimbalPhi = (input.depth ?? 0) * GIMBAL_MAX;
    } else {
      if (this.tick % CONTROL_EVERY === 0) this.controller(input);
      const wanted = this.az / (Math.cos(this.theta) * Math.cos(this.phi) * (THRUST / this.mass));
      this.throttle = Math.max(THROTTLE_MIN, Math.min(1, wanted));
      this.gimbal = this.attitude(this.ax, this.theta, this.omega);
      this.gimbalPhi = this.attitude(this.ay, this.phi, this.omegaPhi);
    }
    if (this.fuel <= 0) this.throttle = 0;

    const a = this.thrustAccel;
    const sideX = Math.sin(this.theta - this.gimbal);
    const sideY = Math.sin(this.phi - this.gimbalPhi);
    const up = Math.sqrt(Math.max(0, 1 - sideX * sideX - sideY * sideY));
    const ax = a * sideX - DRAG * this.vx * Math.abs(this.vx);
    const ay = a * sideY - DRAG * this.vy * Math.abs(this.vy);
    const az = a * up - G - DRAG * this.vz * Math.abs(this.vz);
    const alpha = this.throttle * TORQUE * Math.sin(this.gimbal) - ANGULAR_DAMPING * this.omega;
    const alphaPhi = this.throttle * TORQUE * Math.sin(this.gimbalPhi) - ANGULAR_DAMPING * this.omegaPhi;

    // Semi-implicit Euler.
    this.vx += ax * DT;
    this.vy += ay * DT;
    this.vz += az * DT;
    this.omega += alpha * DT;
    this.omegaPhi += alphaPhi * DT;
    this.x += this.vx * DT;
    this.y += this.vy * DT;
    this.z += this.vz * DT;
    this.theta += this.omega * DT;
    this.phi += this.omegaPhi * DT;
    this.fuel = Math.max(0, this.fuel - this.throttle * BURN * DT);
    if (this.z < LEG_ALTITUDE) this.legs = Math.min(1, this.legs + DT / LEG_TIME);
    this.tick++;

    if (this.z <= 0) {
      this.z = 0;
      if (Math.abs(this.vz) > LIMITS.vz || Math.hypot(this.vx, this.vy) > LIMITS.vx) this.outcome = 'hard';
      else if (Math.hypot(this.theta, this.phi) > LIMITS.tilt) this.outcome = 'tipped';
      else if (Math.hypot(this.x, this.y) > PAD_RADIUS) this.outcome = 'missed';
      else this.outcome = 'landed';
    }
  }
}
