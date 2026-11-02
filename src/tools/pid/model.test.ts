import { describe, expect, it } from 'vitest';
import { AMBIENT, DT, Loop, plants, tunings, type LoopSettings, type PlantName } from './model';

const settings = (name: PlantName, over: Partial<LoopSettings> = {}): LoopSettings => ({ ...tunings[name], closed: true, antiWindup: true, setting: 0.5, ...over });
const run = (loop: Loop, seconds: number, visit?: () => void) => {
  for (let i = 0; i < seconds / DT; i++) {
    loop.step();
    visit?.();
  }
};

describe('plants open loop', () => {
  it('settles a heater where the heat balance says', () => {
    const loop = new Loop('heater', settings('heater', { closed: false }));
    const state = [AMBIENT, AMBIENT];
    let current = state;
    for (let i = 0; i < 20000; i++) current = current.map((value, k) => value + 0.01 * plants.heater.derivative(current, 50)[k]);
    expect(current[1]).toBeCloseTo(AMBIENT + 0.3 * 50 * 2.5, 2);
    run(loop, 5);
    expect(loop.measured).toBe(AMBIENT);
  });
  it('rings a spring at its natural frequency', () => {
    const loop = new Loop('spring', settings('spring', { closed: false }));
    loop.state = [1, 0];
    const crossings: number[] = [];
    let before = loop.measured;
    run(loop, 8, () => {
      if (before > 0 && loop.measured <= 0) crossings.push(loop.time);
      before = loop.measured;
    });
    const wd = Math.sqrt(4 - 0.5 ** 2 / 4);
    expect(crossings[1] - crossings[0]).toBeCloseTo((2 * Math.PI) / wd, 1);
  });
  it('grows from upright at the inverted pendulum rate', () => {
    const loop = new Loop('pendulum', settings('pendulum', { closed: false }));
    loop.state = [1e-3, 0, 0, 0];
    run(loop, 1);
    const rate = Math.sqrt(9.81 / (0.5 * (4 / 3 - 0.1 / 1.1)));
    expect(loop.measured).toBeCloseTo(1e-3 * Math.cosh(rate * 1), 3);
  });
  it('drops a pendulum left alone', () => {
    const loop = new Loop('pendulum', settings('pendulum', { closed: false }));
    run(loop, 5);
    expect(loop.failed).toBe(true);
  });
});

describe('closed loop at the default tuning', () => {
  it('brings a heater to temperature with little overshoot', () => {
    const loop = new Loop('heater', settings('heater'));
    let peak = 0;
    run(loop, 60, () => {
      peak = Math.max(peak, loop.measured);
    });
    expect(loop.measured).toBeCloseTo(50, 0);
    expect(peak).toBeLessThan(54);
  });
  it('recovers a heater after a knock', () => {
    const loop = new Loop('heater', settings('heater'));
    run(loop, 60);
    loop.knock();
    run(loop, 40);
    expect(loop.measured).toBeCloseTo(50, 0);
  });
  it('holds a pendulum upright through knocks', () => {
    const loop = new Loop('pendulum', settings('pendulum'));
    run(loop, 10);
    loop.knock();
    run(loop, 10);
    loop.knock();
    run(loop, 20);
    expect(loop.failed).toBe(false);
    expect(Math.abs(loop.measured)).toBeLessThan(0.01);
  });
  it('follows a new angle', () => {
    const loop = new Loop('pendulum', settings('pendulum'));
    run(loop, 10);
    loop.settings.setting = 0.7;
    run(loop, 15);
    expect(loop.failed).toBe(false);
  });
  it('places a mass on target', () => {
    const loop = new Loop('spring', settings('spring', { setting: 0.8 }));
    run(loop, 20);
    expect(loop.measured).toBeCloseTo(0.6, 2);
  });
});

describe('what each term does', () => {
  it('leaves an offset with proportional alone', () => {
    const loop = new Loop('spring', settings('spring', { ki: 0, kd: 0, kp: 30, setting: 0.8 }));
    run(loop, 40);
    expect(loop.measured).toBeCloseTo((0.6 * 30) / 34, 2);
  });
  it('removes the offset with integral', () => {
    const loop = new Loop('spring', settings('spring', { ki: 10, kd: 5, kp: 30, setting: 0.8 }));
    run(loop, 30);
    expect(loop.measured).toBeCloseTo(0.6, 2);
  });
  it('damps with derivative', () => {
    const swing = (kd: number) => {
      const loop = new Loop('spring', settings('spring', { ki: 0, kd, kp: 30, setting: 0.8 }));
      let peak = 0;
      run(loop, 10, () => {
        peak = Math.max(peak, loop.measured);
      });
      return peak;
    };
    expect(swing(10)).toBeLessThan(swing(0));
  });
  it('overshoots further with windup', () => {
    const peak = (antiWindup: boolean) => {
      const loop = new Loop('heater', settings('heater', { antiWindup, setting: 0.9, ki: 1.5 }));
      let highest = 0;
      run(loop, 80, () => {
        highest = Math.max(highest, loop.measured);
      });
      return highest;
    };
    expect(peak(false)).toBeGreaterThan(peak(true) + 3);
  });
  it('keeps the output inside its limits', () => {
    const loop = new Loop('heater', settings('heater', { kp: 100 }));
    run(loop, 5, () => {
      expect(loop.output).toBeGreaterThanOrEqual(0);
      expect(loop.output).toBeLessThanOrEqual(100);
    });
  });
  it('does not jump the output when the target moves on the derivative term', () => {
    const loop = new Loop('spring', settings('spring', { kp: 0, ki: 0, kd: 20 }));
    run(loop, 5);
    const before = loop.output;
    loop.settings.setting = 1;
    loop.step();
    expect(Math.abs(loop.output - before)).toBeLessThan(1e-6);
  });
  it('cannot hold a pendulum without derivative', () => {
    const loop = new Loop('pendulum', settings('pendulum', { kd: 0 }));
    run(loop, 20);
    expect(loop.failed).toBe(true);
  });
  it('hunts around the target with too much heater gain', () => {
    const loop = new Loop('heater', settings('heater', { kp: 60, ki: 2, kd: 0 }));
    run(loop, 30);
    let [low, high, top, bottom] = [Infinity, -Infinity, 0, 100];
    run(loop, 30, () => {
      low = Math.min(low, loop.measured);
      high = Math.max(high, loop.measured);
      top = Math.max(top, loop.output);
      bottom = Math.min(bottom, loop.output);
    });
    expect(high - low).toBeGreaterThan(0.5);
    expect([bottom, top]).toEqual([0, 100]);
  });
  it('lets the cart wander while the pole stays up', () => {
    const loop = new Loop('pendulum', settings('pendulum'));
    run(loop, 30);
    expect(loop.failed).toBe(false);
    expect(Math.abs(loop.state[2])).toBeGreaterThan(0.1);
  });
  it('is the same every run', () => {
    const a = new Loop('pendulum', settings('pendulum'));
    const b = new Loop('pendulum', settings('pendulum'));
    run(a, 5);
    run(b, 5);
    expect(a.state).toEqual(b.state);
  });
});
