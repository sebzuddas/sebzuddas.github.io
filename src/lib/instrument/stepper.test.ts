import { describe, expect, it } from 'vitest';
import { hero, DT } from '../../tools/cascade/model';
import { Stepper } from './stepper';

function simulate(hz: number, seconds: number) {
  const model = hero(5);
  const stepper = new Stepper(DT, () => model.step());
  for (let i = 0; i < seconds * hz; i++) stepper.advance(1 / hz);
  return { tick: model.tick, activity: model.activity };
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
