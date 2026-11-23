import { build } from "esbuild";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { readFile, writeFile } from "node:fs/promises";

GlobalFonts.registerFromPath("assets/fonts/GeistMono.woff2", "Scene Mono");
const bundle = await build({ stdin: { contents: 'export * from "./client/ascii-scenes"; export * from "./client/ascii-grid";', resolveDir: process.cwd() }, bundle: true, write: false, format: "esm" });
const { asciiScenes, updateAsciiScene, buildAsciiGrid, asciiGlyphs, asciiInk } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const catalog = JSON.parse(await readFile("client/space-images.json", "utf8"));
for (const [id, name] of Object.entries(asciiScenes)) {
  const field = new Uint8Array(768 * 432);
  updateAsciiScene(field, id, 0);
  const grid = buildAsciiGrid(field, 768, 432, 6, 100, "center");
  const canvas = createCanvas(768, 432);
  const context = canvas.getContext("2d");
  context.fillStyle = "#0D0D12";
  context.fillRect(0, 0, 768, 432);
  context.font = `${grid.fontSize}px "Scene Mono"`;
  context.textBaseline = "top";
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const index = row * grid.columns + column;
      context.fillStyle = asciiInk(grid.lights[index] / 255, "devault");
      context.fillText(asciiGlyphs[grid.glyphs[index]], column * grid.cellWidth, row * grid.cellHeight);
    }
  }
  catalog[id] = { name, credit: "Procedural ASCII · inspired by Devault", source: "https://devault.design/ascii-art-generator/library/", image: `data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", 80).toString("base64")}`, field: "" };
}
for (const entry of Object.values(catalog)) delete entry.video;
await writeFile("client/space-images.json", JSON.stringify(catalog));
