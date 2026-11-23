import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createCanvas } from "@napi-rs/canvas";

const bundle = await build({ stdin: { contents: 'export * from "./client/ascii-scenes"; export * from "./client/ascii.web"; export * from "./client/preferences";', resolveDir: process.cwd() }, bundle: true, write: false, format: "esm", plugins: [{ name: "platform", setup(build) {
  build.onResolve({ filter: /^react-native$/ }, () => ({ path: "platform", namespace: "mock" }));
  build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: 'export const Platform = { OS: "web" };' }));
} }] });
const { asciiScenes, updateAsciiScene, mountAsciiBackground, preferencesSchema } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("every procedural scene changes over time and renders deterministically", () => {
  for (const scene of Object.keys(asciiScenes)) {
    const first = new Uint8Array(768 * 432);
    const second = new Uint8Array(first.length);
    updateAsciiScene(first, scene, 0);
    assert.ok(new Set(first).size > 30, scene);
    updateAsciiScene(second, scene, 2);
    assert.notDeepEqual(first, second, scene);
    updateAsciiScene(second, scene, 3600);
    assert.ok(new Set(second).size > 30, scene);
    updateAsciiScene(second, scene, 0);
    assert.deepEqual(first, second, scene);
  }
});

test("live renderer animates glyphs, responds to cursor motion and stops for reduced motion", () => {
  const frames = new Map();
  const events = new Map();
  const visibility = new Map();
  const canvases = [];
  let frameId = 0;
  let motionChange;
  const motion = { matches: false, addEventListener(name, callback) { motionChange = callback; }, removeEventListener() {} };
  globalThis.window = { devicePixelRatio: 1, matchMedia: () => motion };
  globalThis.document = { hidden: false, createElement() {
    const canvas = createCanvas(320, 180);
    const getContext = canvas.getContext.bind(canvas);
    canvas.getContext = kind => kind === "webgl" ? null : getContext(kind);
    canvas.setAttribute = () => {};
    canvas.addEventListener = () => {};
    canvas.removeEventListener = () => {};
    canvas.remove = () => {};
    canvases.push(canvas);
    return canvas;
  }, addEventListener(name, callback) { visibility.set(name, callback); }, removeEventListener(name) { visibility.delete(name); } };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const target = { appendChild() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 180 }), setAttribute() {}, removeAttribute() {}, addEventListener(name, callback) { events.set(name, callback); }, removeEventListener(name) { events.delete(name); } };
  const step = time => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); };
  const renderer = mountAsciiBackground(target, preferencesSchema.parse({ background: "vortex", animated: true, interactive: true }));
  step(100);
  const first = canvases[1].toBuffer("image/png");
  for (let time = 150; time < 800; time += 50) step(time);
  assert.notDeepEqual(canvases[1].toBuffer("image/png"), first);
  renderer.update(preferencesSchema.parse({ background: "vortex", animated: false, interactive: true }));
  step(900);
  assert.equal(frames.size, 0);
  const idle = canvases[1].toBuffer("image/png");
  events.get("pointermove")({ clientX: 100, clientY: 90, timeStamp: 1000 });
  events.get("pointermove")({ clientX: 210, clientY: 90, timeStamp: 1050 });
  step(1100);
  assert.notDeepEqual(canvases[1].toBuffer("image/png"), idle);
  motion.matches = true;
  motionChange();
  step(1200);
  assert.equal(frames.size, 0);
  renderer.dispose();
  assert.equal(events.size, 0);
  assert.equal(visibility.size, 0);
});
