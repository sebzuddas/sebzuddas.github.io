import type { ChannelDef } from '../../tools/types';

/** A rolling two-channel chart recorder. */
export class Recorder {
  private data: Float32Array[];
  private count = 0;

  constructor(
    private channels: ChannelDef[],
    private capacity: number,
  ) {
    this.data = channels.map(() => new Float32Array(capacity));
  }

  push(values: number[]) {
    const slot = this.count % this.capacity;
    values.forEach((v, c) => (this.data[c][slot] = v));
    this.count++;
  }

  clear() {
    this.count = 0;
  }

  private at(channel: number, age: number) {
    return this.data[channel][(this.count - 1 - age) % this.capacity];
  }

  draw(
    canvas: HTMLCanvasElement,
    token: (name: string) => string,
    band?: { channel: number; value: number; width: number },
  ) {
    const g = canvas.getContext('2d');
    if (!g) return;
    const { width: w, height: h } = canvas;
    const ink = [token('--screen-accent'), token('--screen-ink')];
    const unit = Math.min(devicePixelRatio || 1, 2);
    g.fillStyle = token('--screen-bg');
    g.fillRect(0, 0, w, h);

    g.lineWidth = unit;
    for (let i = 0; i <= 30; i++) {
      const x = (i / 30) * w;
      g.strokeStyle = i % 5 === 0 ? token('--screen-dim') : token('--screen-faint');
      g.globalAlpha = i % 5 === 0 ? 0.7 : 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * h;
      g.strokeStyle = token('--screen-faint');
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.globalAlpha = 1;

    const y = (c: number, v: number) => {
      const { min, max } = this.channels[c];
      return h - ((v - min) / (max - min)) * h;
    };
    if (band) {
      const top = y(band.channel, band.value + band.width);
      const bottom = y(band.channel, band.value - band.width);
      g.fillStyle = token('--screen-dim');
      g.globalAlpha = 0.35;
      g.fillRect(0, top, w, bottom - top);
      g.globalAlpha = 1;
      g.strokeStyle = token('--screen-alert');
      g.setLineDash([6 * unit, 5 * unit]);
      g.beginPath();
      g.moveTo(0, y(band.channel, band.value));
      g.lineTo(w, y(band.channel, band.value));
      g.stroke();
      g.setLineDash([]);
    }

    const samples = Math.min(this.count, this.capacity);
    for (let c = this.channels.length - 1; c >= 0; c--) {
      g.beginPath();
      for (let s = 0; s < samples; s++) {
        const px = w - (s / (this.capacity - 1)) * w;
        const py = y(c, this.at(c, s));
        if (s) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.strokeStyle = ink[c];
      g.globalAlpha = 0.2;
      g.lineWidth = 4 * unit;
      g.stroke();
      g.globalAlpha = 1;
      g.lineWidth = 1.4 * unit;
      g.stroke();
    }
  }
}
