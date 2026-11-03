export const DT = 0.01;

export type PlantName = 'heater' | 'pendulum' | 'spring';

export interface Gains {
  kp: number;
  ki: number;
  kd: number;
}

/** A plant holds a state vector and says how it changes. */
interface Plant {
  start: number[];
  /** Largest output, either way, or from zero to this when one-sided. */
  limit: number;
  oneSided: boolean;
  /** -1 when a positive output pushes the measurement down. */
  sign: number;
  /** Seconds before a change reaches the sensor. */
  delay: number;
  derivative(state: number[], force: number): number[];
  measure(state: number[]): number;
  target(setting: number): number;
  knock(state: number[]): void;
  failed(state: number[]): boolean;
}

export const AMBIENT = 20;
const HEATER_WATTS_PER_PERCENT = 0.3;
const GRAVITY = 9.81;
const CART = 1;
const BOB = 0.1;
const LENGTH = 0.5;
const SPRING = { mass: 1, damping: 0.5, stiffness: 4 };

export const plants: Record<PlantName, Plant> = {
  /** A heating element warming a room that loses heat outside: [element, room] in °C. */
  heater: {
    start: [AMBIENT, AMBIENT],
    limit: 100,
    oneSided: true,
    sign: 1,
    delay: 1.5,
    derivative: ([element, room], percent) => [
      HEATER_WATTS_PER_PERCENT * percent - (element - room) / 1.5,
      ((element - room) / 1.5 - (room - AMBIENT) / 2.5) / 4,
    ],
    measure: ([, room]) => room,
    target: (setting) => 20 + 60 * setting,
    knock: (state) => {
      state[1] -= 8;
    },
    failed: () => false,
  },
  /** A pole balanced on a cart: [angle, angular rate, position, speed]. Full nonlinear equations. */
  pendulum: {
    start: [0.1, 0, 0, 0],
    limit: 30,
    oneSided: false,
    sign: -1,
    delay: 0,
    derivative: ([angle, rate, , speed], force) => {
      const total = CART + BOB;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const push = (force + BOB * LENGTH * rate * rate * sin) / total;
      const spin = (GRAVITY * sin - cos * push) / (LENGTH * (4 / 3 - (BOB * cos * cos) / total));
      return [rate, spin, speed, push - (BOB * LENGTH * spin * cos) / total];
    },
    measure: ([angle]) => angle,
    target: (setting) => ((setting - 0.5) * 12 * Math.PI) / 180,
    knock: (state) => {
      state[1] += 0.8;
    },
    failed: ([angle]) => Math.abs(angle) > 1.2,
  },
  /** A mass on a spring and damper: [position, speed]. */
  spring: {
    start: [0, 0],
    limit: 50,
    oneSided: false,
    sign: 1,
    delay: 0,
    derivative: ([position, speed], force) => [speed, (force - SPRING.damping * speed - SPRING.stiffness * position) / SPRING.mass],
    measure: ([position]) => position,
    target: (setting) => 2 * setting - 1,
    knock: (state) => {
      state[1] += 2;
    },
    failed: () => false,
  },
};

/** Tuned by hand for each plant, and held by the tests. */
export const tunings: Record<PlantName, Gains> = {
  heater: { kp: 8, ki: 0.8, kd: 6 },
  pendulum: { kp: 80, ki: 10, kd: 12 },
  spring: { kp: 30, ki: 15, kd: 10 },
};

function rk4(plant: Plant, state: number[], force: number, h: number): number[] {
  const at = (from: number[], slope: number[], step: number) => from.map((value, i) => value + slope[i] * step);
  const k1 = plant.derivative(state, force);
  const k2 = plant.derivative(at(state, k1, h / 2), force);
  const k3 = plant.derivative(at(state, k2, h / 2), force);
  const k4 = plant.derivative(at(state, k3, h), force);
  return state.map((value, i) => value + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

export interface LoopSettings extends Gains {
  closed: boolean;
  /** Stop adding to the integral while the output is at its limit. */
  antiWindup: boolean;
  setting: number;
}

/** A PID loop round one plant, stepped at a fixed rate. */
export class Loop {
  state: number[];
  time = 0;
  output = 0;
  integral = 0;
  private filtered = 0;
  private last: number;
  private plant: Plant;
  private readings: number[];

  constructor(public name: PlantName, public settings: LoopSettings) {
    this.plant = plants[name];
    this.state = [...this.plant.start];
    this.last = this.plant.measure(this.state);
    this.readings = Array(Math.round(this.plant.delay / DT)).fill(this.last);
  }

  get measured() {
    return this.plant.measure(this.state);
  }

  get target() {
    return this.plant.target(this.settings.setting);
  }

  get limit() {
    return this.plant.limit;
  }

  get failed() {
    return this.plant.failed(this.state);
  }

  knock() {
    this.plant.knock(this.state);
  }

  private control(): number {
    const { kp, ki, kd, closed, antiWindup } = this.settings;
    if (!closed) {
      this.integral = 0;
      return 0;
    }
    this.readings.push(this.measured);
    const measured = this.readings.shift()!;
    const error = this.target - measured;
    // On the measurement, not the error, so a jump in target does not kick the output. Lightly filtered, as a real one must be.
    const rate = (measured - this.last) / DT;
    this.last = measured;
    this.filtered += (DT / (0.03 + DT)) * (rate - this.filtered);
    const raw = kp * error + this.integral - kd * this.filtered;
    const { sign, limit, oneSided } = this.plant;
    const low = oneSided ? 0 : -limit;
    const signed = sign * raw;
    const output = Math.max(low, Math.min(limit, signed));
    if (!antiWindup || output === signed) this.integral += ki * error * DT;
    return output;
  }

  step() {
    if (this.failed) return;
    this.output = this.control();
    this.state = rk4(this.plant, this.state, this.output, DT);
    this.time += DT;
  }
}
