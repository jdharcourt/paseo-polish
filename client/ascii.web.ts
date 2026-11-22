import { Platform } from "react-native";
import { createAsciiGpu, type GpuCanvas } from "./ascii-gpu.web";
import spaceBackgrounds from "./space-images.json";
import { asciiGlyphs, buildAsciiGrid } from "./ascii-grid";
import type { Preferences } from "./preferences";

type Pointer = { clientX: number; clientY: number; pointerType?: string };
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
  let cursorX = 0;
  let cursorY = 0;
  let active = true;
  let contextLost = false;
  let visible = true;
  let pointer: { x: number; y: number } | null = null;
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
    if (time - lastTime < 40) { queue(); return; }
    const delta = lastTime ? Math.min(.1, (time - lastTime) / 1000) : 0;
    lastTime = time;
    const animated = values.animated && !reducedMotion.matches;
    if (animated) elapsed += delta;
    const targetX = values.interactive && pointer && !reducedMotion.matches ? pointer.x : 0;
    const targetY = values.interactive && pointer && !reducedMotion.matches ? pointer.y : 0;
    cursorX = reducedMotion.matches ? 0 : cursorX + (targetX - cursorX) * (1 - Math.exp(-delta * 9));
    cursorY = reducedMotion.matches ? 0 : cursorY + (targetY - cursorY) * (1 - Math.exp(-delta * 9));
    if (gpu) {
      if (!gpu.draw(width, height, ratio, grid.cellWidth, grid.cellHeight, values.backgroundScale, { top: 0, center: .5, bottom: 1 }[values.position], elapsed, { custom: 0, lunar: 0, saturn: 1, galaxy: 2, nebula: 3 }[values.background], cursorX, cursorY)) {
        contextLost = true;
        target.removeAttribute("data-paseo-polish-ascii");
        return;
      }
    } else if (context && base) {
      context.clearRect(0, 0, width, height);
      const margin = elapsed > 0 || values.interactive ? .02 : 0;
      context.drawImage(base, -width * margin / 2 + Math.sin(elapsed * .018) * width * .006 + cursorX * width * .006, -height * margin / 2 + (Math.cos(elapsed * .013) - 1) * height * .003 + cursorY * height * .006, width * (1 + margin), height * (1 + margin));
    }
    if (animated || Math.abs(cursorX - targetX) > .0001 || Math.abs(cursorY - targetY) > .0001) queue();
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
    if (!values.interactive || reducedMotion.matches || event.pointerType === "touch") return;
    const bounds = target.getBoundingClientRect();
    pointer = { x: (event.clientX - bounds.left) / bounds.width * 2 - 1, y: (event.clientY - bounds.top) / bounds.height * 2 - 1 };
    queue();
  };
  const onLeave = () => { pointer = null; queue(); };
  const onVisibility = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
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
      pointer = null;
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
