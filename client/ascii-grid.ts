export const asciiColors = {
  amber: [1, .68, .3],
  moss: [.52, 1, .62],
  rose: [1, .5, .62],
  violet: [.8, .55, 1],
};

export const asciiGlyphs = " .,:;il!+<>=?[]{}1tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

export function buildAsciiGrid(
  field: Uint8Array,
  width: number,
  height: number,
  characterSize: number,
  scale: number,
  position: "top" | "center" | "bottom",
) {
  const fontSize = Math.max(characterSize, Math.sqrt(width * height / 90000 / .78));
  const cellWidth = fontSize * .65;
  const cellHeight = fontSize * 1.2;
  const columns = Math.ceil(width / cellWidth);
  const rows = Math.ceil(height / cellHeight);
  const fitted = Math.max(width / 768, height / 432) * scale / 100;
  const left = (width - 768 * fitted) / 2;
  const top = (height - 432 * fitted) * ({ top: 0, center: .5, bottom: 1 }[position]);
  const glyphs = new Uint8Array(columns * rows);
  const tones = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = Math.floor((column * cellWidth + cellWidth / 2 - left) / fitted);
      const y = Math.floor((row * cellHeight + cellHeight / 2 - top) / fitted);
      if (x < 0 || y < 0 || x >= 768 || y >= 432) continue;
      const value = field[y * 768 + x];
      const edge = Math.abs(value - field[y * 768 + Math.max(0, x - 1)]) + Math.abs(value - field[Math.max(0, y - 1) * 768 + x]);
      const light = Math.min(1, Math.max(0, (value / 255 - .02) * 1.35 + edge / 255 * .25)) ** .8;
      const index = row * columns + column;
      glyphs[index] = Math.round(light * (asciiGlyphs.length - 1));
      tones[index] = Math.round(75 + light * 170);
    }
  }
  return { columns, rows, cellWidth, cellHeight, fontSize, glyphs, tones };
}
