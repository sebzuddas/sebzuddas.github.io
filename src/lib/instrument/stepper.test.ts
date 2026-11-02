import { describe, expect, it } from 'vitest';
import { Stepper } from './stepper';

const DT = 0.05;

function simulate(hz: number, seconds: number) {
  const model = { tick: 0, value: 1 };
  const stepper = new Stepper(DT, () => {
    model.tick++;
    model.value = (model.value * 3.7 * (1 - model.value / 4)) % 4;
  });
  for (let i = 0; i < seconds * hz; i++) stepper.advance(1 / hz);
  return model;
}

describe('Stepper', () => {
  it('gives identical behaviour at 30 Hz and 120 Hz', () => {
    expect(simulate(30, 20)).toEqual(simulate(120, 20));
  });
  it('drops the backlog after a stall', () => {
    let steps = 0;
    const stepper = new Stepper(0.05, () => steps++, 8);
    stepper.advance(10);
    expect(steps).toBe(8);
    expect(stepper.alpha).toBe(0);
  });
});
