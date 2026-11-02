import { RATE } from './model';

/** Kept low because a saw wave at full level is unpleasant at any volume. */
const MAX_VOLUME = 0.2;
const FADE = 0.03;

/** Plays one second of samples on a loop, fading across when the sound changes. */
export class Speaker {
  private context?: AudioContext;
  private voice?: { source: AudioBufferSourceNode; gain: GainNode };

  get playing() {
    return Boolean(this.voice);
  }

  async play(samples: Float64Array) {
    this.context ??= new AudioContext();
    await this.context.resume();
    this.update(samples);
  }

  update(samples: Float64Array) {
    if (!this.context) return;
    const { context } = this;
    const buffer = context.createBuffer(1, samples.length, RATE);
    const peak = Math.max(1, ...samples.map(Math.abs));
    buffer.copyToChannel(Float32Array.from(samples, (value) => value / peak), 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(MAX_VOLUME, context.currentTime + FADE);
    source.connect(gain).connect(context.destination);
    source.start();
    this.release();
    this.voice = { source, gain };
  }

  private release() {
    if (!this.voice || !this.context) return;
    const { source, gain } = this.voice;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + FADE);
    source.stop(now + FADE);
    this.voice = undefined;
  }

  stop() {
    this.release();
  }
}
