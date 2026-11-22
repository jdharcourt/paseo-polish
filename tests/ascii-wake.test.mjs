import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["client/ascii-wake.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { AsciiWake } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("cursor sweeps deform a local wake and leave distant artwork unchanged", () => {
  const wake = new AsciiWake(1200, 800);
  const sample = new Float32Array(3);
  wake.move(400, 400, 100);
  wake.move(600, 400, 150);
  wake.step(0);
  wake.sample(500, 424, sample);
  assert.ok(sample[0] > 0);
  assert.ok(sample[1] > 0);
  assert.ok(sample[2] > 0);
  wake.sample(500, 376, sample);
  assert.ok(sample[1] < 0);
  wake.sample(500, 600, sample);
  assert.deepEqual([...sample], [0, 0, 0]);
});

test("a fast sweep leaves a continuous trail rather than isolated event spots", () => {
  const wake = new AsciiWake(1400, 800);
  const sample = new Float32Array(3);
  wake.move(100, 400, 100);
  wake.move(1300, 400, 116);
  wake.step(0);
  for (let x = 120; x < 1300; x += 20) {
    wake.sample(x, 400, sample);
    assert.ok(sample[2] > .4);
  }
  assert.ok(wake.pixels.length <= 192 * 192 * 4);
});

test("the wake settles completely so idle backgrounds can stop requesting frames", () => {
  const wake = new AsciiWake(1200, 800);
  wake.move(400, 400, 100);
  wake.move(600, 400, 150);
  wake.step(0);
  assert.equal(wake.active, true);
  for (let frame = 0; frame < 75; frame++) wake.step(1 / 30);
  assert.equal(wake.active, false);
  for (let i = 0; i < wake.pixels.length; i += 4) {
    assert.deepEqual([...wake.pixels.slice(i, i + 4)], [128, 128, 0, 255]);
  }
});

test("leaving or pausing never draws a line across the pane on re-entry", () => {
  const wake = new AsciiWake(1200, 800);
  wake.move(100, 100, 100);
  wake.leave();
  wake.move(1000, 700, 116);
  assert.equal(wake.active, false);
  wake.move(100, 100, 1000);
  assert.equal(wake.active, false);
  for (const point of [[NaN, 200, 1010], [200, Infinity, 1020], [-1, 100, 1030]]) wake.move(...point);
  assert.equal(wake.active, false);
});

test("clear removes pending displacement immediately for reduced motion or disabled interaction", () => {
  const wake = new AsciiWake(1200, 800);
  const sample = new Float32Array(3);
  wake.move(400, 400, 100);
  wake.move(600, 400, 116);
  wake.clear();
  wake.sample(500, 400, sample);
  assert.deepEqual([...sample], [0, 0, 0]);
  assert.equal(wake.active, false);
  wake.move(800, 400, 132);
  assert.equal(wake.active, false);
});

test("repeated motion stays bounded on large displays and at pane edges", () => {
  const wake = new AsciiWake(7680, 4320);
  assert.ok(wake.pixels.length <= 192 * 192 * 4);
  for (let i = 0; i < 100; i++) {
    wake.move(i % 2 ? 100 : 0, 0, i * 16);
    wake.step(1 / 60);
  }
  assert.ok(wake.pixels.every(Number.isFinite));
  assert.ok(wake.bounds.left >= 0 && wake.bounds.top >= 0);
  assert.ok(wake.bounds.right <= 7680 && wake.bounds.bottom <= 4320);
});
