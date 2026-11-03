/** Fixed timestep with an accumulator, so behaviour does not depend on frame rate. */
export class Stepper {
  private acc = 0;

  constructor(
    private dt: number,
    private step: () => void,
    private maxSteps = 8,
  ) {}

  advance(elapsed: number) {
    this.acc += elapsed;
    let steps = 0;
    while (this.acc >= this.dt - 1e-9 && steps < this.maxSteps) {
      this.step();
      this.acc -= this.dt;
      steps++;
    }
    // After a stall, drop the backlog rather than fast-forwarding.
    if (steps === this.maxSteps) this.acc = 0;
  }

  /** Fraction of a step since the last one, for smooth drawing. */
  get alpha() {
    return Math.max(0, this.acc / this.dt);
  }
}
