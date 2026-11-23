import { Platform } from "react-native";
import { createAsciiGpu, type GpuCanvas } from "./ascii-gpu.web";
import spaceBackgrounds from "./space-images.json";
import { asciiGlyphs, buildAsciiGrid } from "./ascii-grid";
import { AsciiWake } from "./ascii-wake";
import type { Preferences } from "./preferences";

type Pointer = { clientX: number; clientY: number; timeStamp: number; pointerType?: string };
export type AsciiTarget = {
  appendChild(canvas: AsciiCanvas): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(name: "pointermove" | "pointerleave", callback: (event: Pointer) => void, options?: { passive: boolean }): void;
  removeEventListener(name: "pointermove" | "pointerleave", callback: (event: Pointer) => void): void;
};
type Context = {
  font: string;
  fillStyle: string;
  textBaseline: string;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(canvas: AsciiCanvas, ...coordinates: number[]): void;
};
type AsciiCanvas = GpuCanvas & {
  width: number;
  height: number;
  setAttribute(name: string, value: string): void;
  getContext(kind: "2d"): Context | null;
  remove(): void;
  addEventListener(name: "webglcontextlost" | "webglcontextrestored", callback: (event: { preventDefault(): void }) => void): void;
  removeEventListener(name: "webglcontextlost" | "webglcontextrestored", callback: (event: { preventDefault(): void }) => void): void;
};
declare const document: {
  hidden: boolean;
  fonts?: { load(font: string): Promise<unknown> };
  createElement(tag: "video"): AsciiCanvas & { src: string; poster: string; muted: boolean; loop: boolean; playsInline: boolean; play(): Promise<void>; pause(): void };
  createElement(tag: "canvas"): AsciiCanvas;
  addEventListener(name: "visibilitychange", callback: () => void): void;
  removeEventListener(name: "visibilitychange", callback: () => void): void;
};
declare const window: {
  devicePixelRatio: number;
  matchMedia(query: string): {
    matches: boolean;
    addEventListener(name: "change", callback: () => void): void;
    removeEventListener(name: "change", callback: () => void): void;
  };
};
declare function requestAnimationFrame(callback: (time: number) => void): number;
declare function cancelAnimationFrame(id: number): void;
declare function atob(value: string): string;
declare const ResizeObserver: new (callback: () => void) => { observe(target: AsciiTarget): void; disconnect(): void };
declare const IntersectionObserver: new (callback: (entries: { isIntersecting: boolean }[]) => void) => { observe(target: AsciiTarget): void; disconnect(): void };

const fields = new Map<string, Uint8Array>();

export function mountAsciiBackground(target: AsciiTarget, initial: Preferences) {
  if (Platform.OS !== "web" || initial.background === "custom" || typeof ResizeObserver === "undefined" || typeof window.matchMedia !== "function") return;
  if (initial.background.startsWith("devault")) {
    const media = document.createElement("video");
    media.setAttribute("data-paseo-polish-canvas", "");
    media.setAttribute("aria-hidden", "true");
    media.setAttribute("style", "object-fit:cover");
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let current = initial;
    const update = (next: Preferences) => {
      current = next;
      if (next.background === "custom") return;
      const entry = spaceBackgrounds[next.background];
      media.poster = entry.image;
      if (media.src !== entry.video) media.src = entry.video;
      if (next.animated && !motion.matches && !document.hidden && entry.video) void media.play().catch(() => {});
      else media.pause();
    };
    const refresh = () => update(current);
    target.appendChild(media);
    target.setAttribute("data-paseo-polish-ascii", "");
    motion.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    update(initial);
    return { update, dispose() {
      media.pause();
      media.remove();
      target.removeAttribute("data-paseo-polish-ascii");
      motion.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
    } };
  }
  let canvas = document.createElement("canvas");
  let gpu = createAsciiGpu(canvas);
  if (!gpu) canvas = document.createElement("canvas");
  const base = gpu ? null : document.createElement("canvas");
  const context = gpu ? null : canvas.getContext("2d");
  const baseContext = base?.getContext("2d");
  if (!gpu && (!context || !baseContext)) return;
  let values = initial;
  let field: Uint8Array = new Uint8Array(0);
  let width = 0;
  let height = 0;
  let ratio = 1;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let wake = new AsciiWake(1, 1);
  const sample = new Float32Array(3);
  let active = true;
  let contextLost = false;
  let visible = true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let grid = buildAsciiGrid(field, 1, 1, values.characterSize, values.backgroundScale, values.position);
  canvas.setAttribute("data-paseo-polish-canvas", "");
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("data-paseo-polish-renderer", gpu ? "webgl" : "2d");
  target.appendChild(canvas);

  const queue = () => {
    if (frame || !active || contextLost || !visible || document.hidden || !width || !height) return;
    frame = requestAnimationFrame(draw);
  };
  const draw = (time: number) => {
    frame = 0;
    if (!active || contextLost || !visible || document.hidden) return;
    if (time - lastTime < 1000 / 30) { queue(); return; }
    const delta = lastTime ? Math.min(.1, (time - lastTime) / 1000) : 0;
    lastTime = time;
    const animated = values.animated && !reducedMotion.matches;
    if (animated) elapsed += delta;
    if (wake.active) wake.step(delta);
    if (gpu) {
      if (!gpu.draw(width, height, ratio, grid.cellWidth, grid.cellHeight, values.backgroundScale, { top: 0, center: .5, bottom: 1 }[values.position], elapsed, ({ custom: 0, lunar: 0, saturn: 1, galaxy: 2, nebula: 3 } as Record<string, number>)[values.background] ?? 0, wake)) {
        contextLost = true;
        target.removeAttribute("data-paseo-polish-ascii");
        return;
      }
    } else if (context && base) {
      context.clearRect(0, 0, width, height);
      const margin = elapsed > 0 ? .02 : 0;
      const driftX = -width * margin / 2 + Math.sin(elapsed * .018) * width * .006;
      const driftY = -height * margin / 2 + (Math.cos(elapsed * .013) - 1) * height * .003;
      context.drawImage(base, driftX, driftY, width * (1 + margin), height * (1 + margin));
      if (wake.active) {
        const fit = Math.max(width / 768, height / 432) * values.backgroundScale / 100;
        const left = (width - 768 * fit) / 2;
        const top = (height - 432 * fit) * ({ top: 0, center: .5, bottom: 1 }[values.position]);
        const cellWidth = grid.cellWidth * (1 + margin);
        const cellHeight = grid.cellHeight * (1 + margin);
        for (let row = Math.max(0, Math.floor((wake.bounds.top - driftY) / cellHeight)); row < Math.min(grid.rows, Math.ceil((wake.bounds.bottom - driftY) / cellHeight)); row++) {
          for (let column = Math.max(0, Math.floor((wake.bounds.left - driftX) / cellWidth)); column < Math.min(grid.columns, Math.ceil((wake.bounds.right - driftX) / cellWidth)); column++) {
            const px = column * cellWidth + driftX;
            const py = row * cellHeight + driftY;
            wake.sample(px + cellWidth / 2, py + cellHeight / 2, sample);
            if (!sample[0] && !sample[1] && !sample[2]) continue;
            const x = Math.max(0, Math.min(767, Math.floor(((px + cellWidth / 2 - driftX) / (1 + margin) - sample[0] - left) / fit)));
            const y = Math.max(0, Math.min(431, Math.floor(((py + cellHeight / 2 - driftY) / (1 + margin) - sample[1] - top) / fit)));
            const value = field[y * 768 + x];
            const edge = Math.abs(value - field[y * 768 + Math.max(0, x - 1)]) + Math.abs(value - field[Math.max(0, y - 1) * 768 + x]);
            const light = Math.min(1, Math.max(0, (value / 255 - .02) * 1.35 + edge / 255 * .25)) ** .8 * (1 - sample[2] * .85);
            context.fillStyle = "#080808";
            context.fillRect(px, py, cellWidth, cellHeight);
            const tone = Math.round(75 + light * 170);
            context.fillStyle = `rgb(${tone},${tone},${tone})`;
            context.fillText(asciiGlyphs[Math.round(light * (asciiGlyphs.length - 1))], px, py);
          }
        }
      }
    }
    if (animated || wake.active) queue();
  };
  const refresh = () => {
    if (!active || contextLost || values.background === "custom") return;
    if (!fields.has(values.background)) {
      const decoded = atob(spaceBackgrounds[values.background].field);
      if (decoded.length !== 768 * 432) return;
      fields.set(values.background, Uint8Array.from(decoded, (value) => value.charCodeAt(0)));
    }
    field = fields.get(values.background)!;
    const bounds = target.getBoundingClientRect();
    width = Math.round(bounds.width);
    height = Math.round(bounds.height);
    if (!width || !height) {
      cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    ratio = Math.min(2, window.devicePixelRatio || 1, 4096 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    if (base) { base.width = canvas.width; base.height = canvas.height; }
    grid = buildAsciiGrid(field, width, height, values.characterSize, values.backgroundScale, values.position);
    wake = new AsciiWake(width, height, values.cursorForce, values.cursorStrength, values.cursorTrail, values.cursorBounce);
    if (gpu) {
      gpu.setField(field);
      gpu.refreshAtlas();
    } else if (context && baseContext) {
      for (const ctx of [context, baseContext]) {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.font = `${grid.fontSize}px "Paseo Geist Mono",Menlo,monospace`;
        ctx.textBaseline = "top";
      }
      baseContext.fillStyle = "#080808";
      baseContext.fillRect(0, 0, width, height);
      for (let row = 0; row < grid.rows; row++) {
        for (let column = 0; column < grid.columns; column++) {
          const index = row * grid.columns + column;
          if (!grid.glyphs[index]) continue;
          const tone = grid.tones[index];
          baseContext.fillStyle = `rgb(${tone},${tone},${tone})`;
          baseContext.fillText(asciiGlyphs[grid.glyphs[index]], column * grid.cellWidth, row * grid.cellHeight);
        }
      }
    }
    target.setAttribute("data-paseo-polish-ascii", "");
    lastTime = 0;
    queue();
  };
  const onPointer = (event: Pointer) => {
    if (!values.interactive || reducedMotion.matches || !visible || document.hidden || event.pointerType === "touch") return;
    const bounds = target.getBoundingClientRect();
    wake.move(event.clientX - bounds.left, event.clientY - bounds.top, event.timeStamp);
    if (wake.active) queue();
  };
  const onLeave = () => { wake.leave(); };
  const onVisibility = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    wake.clear();
    lastTime = 0;
    queue();
  };
  const onContextLost = (event: { preventDefault(): void }) => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    target.removeAttribute("data-paseo-polish-ascii");
  };
  const onContextRestored = () => {
    if (!active) return;
    gpu?.dispose();
    gpu = createAsciiGpu(canvas);
    contextLost = !gpu;
    refresh();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  const resize = new ResizeObserver(refresh);
  const intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    onVisibility();
  });
  resize.observe(target);
  intersection?.observe(target);
  target.addEventListener("pointermove", onPointer, { passive: true });
  target.addEventListener("pointerleave", onLeave);
  reducedMotion.addEventListener("change", onVisibility);
  document.addEventListener("visibilitychange", onVisibility);
  refresh();
  void document.fonts?.load('12px "Paseo Geist Mono"').then(refresh, refresh);
  return {
    update(next: Preferences) {
      if (values === next) return;
      values = next;
      refresh();
    },
    dispose() {
      active = false;
      cancelAnimationFrame(frame);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      gpu?.dispose();
      resize.disconnect();
      intersection?.disconnect();
      target.removeEventListener("pointermove", onPointer);
      target.removeEventListener("pointerleave", onLeave);
      reducedMotion.removeEventListener("change", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      target.removeAttribute("data-paseo-polish-ascii");
      canvas.remove();
    },
  };
}
