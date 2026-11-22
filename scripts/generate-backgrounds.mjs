import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

if (process.platform === 'darwin') GlobalFonts.registerFromPath('/System/Library/Fonts/Menlo.ttc', 'Menlo');
else GlobalFonts.registerFromPath('assets/fonts/GeistMono.woff2', 'Menlo');
const backgrounds = {
  lunar: { name: 'Lunar terrain', nasaId: 'GSFC_20171208_Archive_e001225', credit: 'NASA / GSFC / Arizona State University' },
  saturn: { name: 'Saturn rings', nasaId: 'PIA17172', credit: 'NASA / JPL-Caltech / SSI' },
  galaxy: { name: 'Whirlpool galaxy', nasaId: 'PIA04230', credit: 'NASA / Hubble Heritage Team / STScI / AURA' },
  nebula: { name: 'Pillars of Creation', nasaId: 'GSFC_20171208_Archive_e000842', credit: 'NASA / ESA / Hubble Heritage Team' },
};
const catalog = {};
const preview = createCanvas(1280, 768);
const previewContext = preview.getContext('2d');
previewContext.fillStyle = '#080808';
previewContext.fillRect(0, 0, 1280, 768);
previewContext.font = '16px Menlo';
await mkdir('assets/space/source', { recursive: true });
for (const [id, entry] of Object.entries(backgrounds)) {
  const path = `assets/space/source/${id}.jpg`;
  let bytes;
  try { bytes = await readFile(path); } catch {
    bytes = execFileSync('curl', ['-fsSL', '--max-time', '60', `https://images-assets.nasa.gov/image/${entry.nasaId}/${entry.nasaId}~orig.jpg`], { maxBuffer: 40 * 1024 * 1024 });
    await writeFile(path, bytes);
  }
  const photo = await loadImage(bytes);
  const sample = createCanvas(768, 432);
  const source = sample.getContext('2d');
  source.fillStyle = '#000';
  source.fillRect(0, 0, 768, 432);
  const cover = Math.max(768 / photo.width, 432 / photo.height);
  source.drawImage(photo, (768 - photo.width * cover) / 2, (432 - photo.height * cover) / 2, photo.width * cover, photo.height * cover);
  const pixels = source.getImageData(0, 0, 768, 432).data;
  const field = Buffer.alloc(768 * 432);
  for (let i = 0; i < field.length; i++) field[i] = Math.round(pixels[i * 4] * .2126 + pixels[i * 4 + 1] * .7152 + pixels[i * 4 + 2] * .0722);
  const canvas = createCanvas(3840, 2160);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, 3840, 2160);
  ctx.font = '8px Menlo';
  ctx.textBaseline = 'top';
  const lines = [];
  const glyphs = ' .,:;il!+<>=?[]{}1tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
  for (let y = 0; y < 240; y++) {
    let line = '';
    for (let x = 0; x < 640; x++) {
      const raw = field[Math.min(431, Math.floor(y * 432 / 240)) * 768 + Math.min(767, Math.floor(x * 768 / 640))] / 255;
      const light = Math.min(1, Math.max(0, (raw - .02) * 1.5)) ** .8;
      const glyph = glyphs[Math.round(light * (glyphs.length - 1))];
      line += glyph;
      if (glyph === ' ') continue;
      const tone = Math.round(75 + light * 170);
      ctx.fillStyle = `rgb(${tone},${tone},${tone})`;
      ctx.fillText(glyph, x * 6, y * 9);
    }
    lines.push(line);
  }
  const rendered = canvas.toBuffer('image/jpeg', 78);
  await writeFile(`assets/space/${id}.jpg`, rendered);
  await writeFile(`assets/space/${id}.txt`, lines.map(line => line.trimEnd()).join('\n').trimEnd() + '\n');
  const thumbnail = createCanvas(768, 432);
  thumbnail.getContext('2d').drawImage(canvas, 0, 0, 768, 432);
  catalog[id] = { field: field.toString('base64'), name: entry.name, credit: entry.credit, source: `https://images.nasa.gov/details/${entry.nasaId}`, image: `data:image/jpeg;base64,${thumbnail.toBuffer('image/jpeg', 82).toString('base64')}` };
  const i = Object.keys(backgrounds).indexOf(id);
  previewContext.drawImage(canvas, (i % 2) * 640, Math.floor(i / 2) * 384 + 24, 640, 360);
  previewContext.fillStyle = '#ddd';
  previewContext.fillText(entry.name, (i % 2) * 640 + 12, Math.floor(i / 2) * 384 + 18);
  console.log(`${id}: ${Math.round(rendered.length / 1024)} KB`);
}
await writeFile('client/space-images.json', JSON.stringify(catalog));

await writeFile('assets/space/selection.jpg', preview.toBuffer('image/jpeg', 88));
