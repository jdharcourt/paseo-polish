export class AsciiWake {
  columns;
  rows;
  pixels;
  private displacementX;
  private displacementY;
  private velocityX;
  private velocityY;
  private clearance;
  private previous: { x: number; y: number; time: number } | null = null;
  active = false;
  bounds = { left: 0, top: 0, right: 0, bottom: 0 };

  constructor(private width: number, private height: number, private force: "push" | "pull" = "push", private strength = 50, private trail = 50, private bounce = 0) {
    this.columns = Math.min(192, Math.max(2, Math.ceil(width / 12)));
    this.rows = Math.min(192, Math.max(2, Math.ceil(height / 12)));
    this.displacementX = new Float32Array(this.columns * this.rows);
    this.displacementY = new Float32Array(this.columns * this.rows);
    this.velocityX = new Float32Array(this.columns * this.rows);
    this.velocityY = new Float32Array(this.columns * this.rows);
    this.clearance = new Float32Array(this.columns * this.rows);
    this.pixels = new Uint8Array(this.columns * this.rows * 4);
    this.clear();
  }

  move(x: number, y: number, time: number) {
    if (!this.strength) return;
    if (![x, y, time].every(Number.isFinite)) return;
    if (x < 0 || y < 0 || x > this.width || y > this.height) { this.leave(); return; }
    const previous = this.previous;
    this.previous = { x, y, time };
    if (!previous || time <= previous.time || time - previous.time > 180) return;
    const dx = x - previous.x;
    const dy = y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (distance < .5) return;
    if (!this.trail) {
      this.clear();
      this.previous = { x, y, time };
    }
    const strength = Math.min(1, distance / Math.max(8, time - previous.time) / 1.4);
    const radius = 52 + 24 * strength;
    const direction = this.force === "push" ? 1 : -1;
    const left = Math.max(0, Math.floor((Math.min(x, previous.x) - radius) / this.width * this.columns));
    const right = Math.min(this.columns, Math.ceil((Math.max(x, previous.x) + radius) / this.width * this.columns));
    const top = Math.max(0, Math.floor((Math.min(y, previous.y) - radius) / this.height * this.rows));
    const bottom = Math.min(this.rows, Math.ceil((Math.max(y, previous.y) + radius) / this.height * this.rows));
    for (let row = top; row < bottom; row++) {
      for (let column = left; column < right; column++) {
        const px = (column + .5) / this.columns * this.width;
        const py = (row + .5) / this.rows * this.height;
        const along = this.trail ? Math.max(0, Math.min(1, ((px - previous.x) * dx + (py - previous.y) * dy) / (distance * distance))) : 1;
        const rx = px - previous.x - along * dx;
        const ry = py - previous.y - along * dy;
        const radial = Math.hypot(rx, ry);
        if (radial >= radius) continue;
        const falloff = (1 - radial / radius) ** 2;
        const force = Math.min(distance, 32) * (.45 + strength * .55) * falloff * this.strength / 50;
        const index = row * this.columns + column;
        this.displacementX[index] = Math.max(-40, Math.min(40, this.displacementX[index] + (rx / Math.max(1, radial) * .8 + dx / distance * .35) * force * direction));
        this.displacementY[index] = Math.max(-40, Math.min(40, this.displacementY[index] + (ry / Math.max(1, radial) * .8 + dy / distance * .35) * force * direction));
        if (this.force === "push") this.clearance[index] = Math.min(1, this.clearance[index] + falloff * Math.min(1, distance / 28) * (.5 + strength * .5) * this.strength / 50);
      }
    }
    this.active = true;
  }

  step(seconds: number) {
    const duration = .35 + this.trail * .013;
    const displacementDecay = Math.exp(-seconds * 4.5 / duration);
    const clearanceDecay = Math.exp(-seconds * 3 / duration);
    const damping = (10 - this.bounce * .06) / duration;
    const stiffness = 196 / (duration * duration);
    const frequency = Math.sqrt(stiffness - damping * damping);
    const springDecay = Math.exp(-damping * seconds);
    const sine = Math.sin(frequency * seconds) / frequency;
    const cosine = Math.cos(frequency * seconds);
    let left = this.columns, top = this.rows, right = 0, bottom = 0;
    this.active = false;
    for (let index = 0; index < this.clearance.length; index++) {
      let x = this.displacementX[index] * displacementDecay;
      let y = this.displacementY[index] * displacementDecay;
      let vx = 0, vy = 0;
      if (this.bounce) {
        const px = this.displacementX[index], py = this.displacementY[index];
        const ux = this.velocityX[index], uy = this.velocityY[index];
        x = springDecay * (px * cosine + (ux + damping * px) * sine);
        y = springDecay * (py * cosine + (uy + damping * py) * sine);
        vx = springDecay * (ux * cosine - (damping * ux + stiffness * px) * sine);
        vy = springDecay * (uy * cosine - (damping * uy + stiffness * py) * sine);
      }
      if (Math.abs(x) > 56) { x = Math.sign(x) * 56; vx = 0; }
      if (Math.abs(y) > 56) { y = Math.sign(y) * 56; vy = 0; }
      let clearance = this.clearance[index] * clearanceDecay;
      if (Math.abs(x) < .2 && Math.abs(vx) < 1) x = vx = 0;
      if (Math.abs(y) < .2 && Math.abs(vy) < 1) y = vy = 0;
      if (clearance < .004) clearance = 0;
      this.displacementX[index] = x;
      this.displacementY[index] = y;
      this.velocityX[index] = vx;
      this.velocityY[index] = vy;
      this.clearance[index] = clearance;
      this.pixels[index * 4] = Math.round(128 + x * 2);
      this.pixels[index * 4 + 1] = Math.round(128 + y * 2);
      this.pixels[index * 4 + 2] = Math.round(clearance * 255);
      if (!x && !y && !vx && !vy && !clearance) continue;
      this.active = true;
      left = Math.min(left, index % this.columns);
      right = Math.max(right, index % this.columns + 1);
      top = Math.min(top, Math.floor(index / this.columns));
      bottom = Math.max(bottom, Math.floor(index / this.columns) + 1);
    }
    this.bounds = {
      left: Math.max(0, (left - 1) / this.columns * this.width),
      top: Math.max(0, (top - 1) / this.rows * this.height),
      right: Math.min(this.width, (right + 1) / this.columns * this.width),
      bottom: Math.min(this.height, (bottom + 1) / this.rows * this.height),
    };
  }

  sample(x: number, y: number, result: Float32Array) {
    const column = Math.max(0, Math.min(this.columns - 1, x / this.width * this.columns - .5));
    const row = Math.max(0, Math.min(this.rows - 1, y / this.height * this.rows - .5));
    const left = Math.floor(column), top = Math.floor(row);
    const right = Math.min(this.columns - 1, left + 1), bottom = Math.min(this.rows - 1, top + 1);
    for (let channel = 0; channel < 3; channel++) {
      const field = channel === 0 ? this.displacementX : channel === 1 ? this.displacementY : this.clearance;
      const a = field[top * this.columns + left] * (1 - column + left) + field[top * this.columns + right] * (column - left);
      const b = field[bottom * this.columns + left] * (1 - column + left) + field[bottom * this.columns + right] * (column - left);
      result[channel] = a * (1 - row + top) + b * (row - top);
    }
  }

  leave() { this.previous = null; }

  clear() {
    this.previous = null;
    this.active = false;
    this.displacementX.fill(0);
    this.displacementY.fill(0);
    this.velocityX.fill(0);
    this.velocityY.fill(0);
    this.clearance.fill(0);
    for (let index = 0; index < this.pixels.length; index += 4) {
      this.pixels[index] = this.pixels[index + 1] = 128;
      this.pixels[index + 2] = 0;
      this.pixels[index + 3] = 255;
    }
  }
}
