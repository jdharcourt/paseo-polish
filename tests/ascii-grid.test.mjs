import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const bundle = await build({ entryPoints: ["client/ascii-grid.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { buildAsciiGrid, asciiGlyphs } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("smaller character sizes expose more photo detail without changing the full-window coverage", () => {
  const field = new Uint8Array(768 * 432).fill(255);
  const fine = buildAsciiGrid(field, 1440, 900, 4, 100, "center");
  const coarse = buildAsciiGrid(field, 1440, 900, 16, 100, "center");
  assert.ok(fine.glyphs.length > coarse.glyphs.length * 8);
  assert.ok(fine.columns * fine.cellWidth >= 1440);
  assert.ok(fine.rows * fine.cellHeight >= 900);
  assert.ok(fine.glyphs.every((glyph) => glyph > 0));
  assert.ok(fine.glyphs.length < 92000);
});

test("black photographs stay empty and oversized windows keep a bounded character count", () => {
  const grid = buildAsciiGrid(new Uint8Array(768 * 432), 7680, 4320, 4, 100, "center");
  assert.ok(grid.glyphs.every((glyph) => glyph === 0));
  assert.ok(grid.glyphs.length < 92000);
  assert.equal(new Set(asciiGlyphs).size, asciiGlyphs.length);
});

test("artwork zoom changes the sampled photo independently of character size", () => {
  const field = Uint8Array.from({ length: 768 * 432 }, (_, index) => index % 768 < 250 ? 0 : 255);
  const fitted = buildAsciiGrid(field, 1200, 800, 8, 100, "center");
  const zoomed = buildAsciiGrid(field, 1200, 800, 8, 200, "center");
  assert.equal(fitted.glyphs.length, zoomed.glyphs.length);
  assert.notDeepEqual(fitted.glyphs, zoomed.glyphs);
});

test("every bundled preset contains genuine high-resolution photo luminance", async () => {
  const catalog = JSON.parse(await readFile("client/space-images.json", "utf8"));
  for (const entry of Object.values(catalog)) {
    if (entry.source === "https://devault.design/ascii-art-generator/library/") {
      assert.match(entry.image, /^data:image\/webp;base64,/);
      if (entry.name.includes("animated")) assert.match(entry.video, /^data:video\/mp4;base64,/);
      continue;
    }
    const field = Buffer.from(entry.field, "base64");
    assert.equal(field.length, 768 * 432);
    assert.ok(new Set(field).size > 200);
    assert.match(entry.image, /^data:image\/jpeg;base64,\/9j\//);
  }
});
