export const asciiPalettes = {
  devault: {"label": "Devault", "stops": [[74, 64, 173], [138, 129, 242], [208, 188, 247], [244, 241, 253]]},
  phosphor: {"label": "Console", "stops": [[15, 122, 53], [43, 217, 91], [157, 255, 184], [226, 255, 235]]},
  amber: {"label": "Amber", "stops": [[138, 67, 0], [255, 159, 26], [255, 210, 122], [255, 241, 210]]},
  ice: {"label": "Glacier", "stops": [[30, 79, 216], [56, 182, 255], [168, 230, 255], [240, 251, 255]]},
  sunset: {"label": "Dusk", "stops": [[91, 26, 143], [224, 69, 123], [255, 179, 71], [255, 243, 196]]},
  cyber: {"label": "Electric", "stops": [[123, 44, 255], [255, 42, 109], [5, 217, 232], [209, 247, 255]]},
  mono: {"label": "Mono", "stops": [[90, 90, 102], [154, 154, 168], [214, 214, 222], [255, 255, 255]]}
};

export const asciiPaletteLookup = Object.fromEntries(Object.entries(asciiPalettes).map(([key, palette]) => [key, Uint8Array.from({ length: 768 }, (_, index) => {
  const position = Math.floor(index / 3) / 255 * 3;
  const stop = Math.min(2, Math.floor(position));
  const channel = index % 3;
  return Math.round(palette.stops[stop][channel] + (palette.stops[stop + 1][channel] - palette.stops[stop][channel]) * (position - stop));
})]));

export function asciiInk(light: number, palette?: string) {
  if (!palette) {
    const tone = Math.round(75 + light * 170);
    return `rgb(${tone},${tone},${tone})`;
  }
  const colors = asciiPaletteLookup[palette];
  const index = Math.round(Math.max(0, Math.min(1, light)) * 255) * 3;
  return `rgb(${colors[index]},${colors[index + 1]},${colors[index + 2]})`;
}

export const asciiGlyphs = " .:-=+*#%@";

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
  const lights = new Uint8Array(columns * rows);
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
      lights[index] = Math.round(light * 255);
      tones[index] = Math.round(75 + light * 170);
    }
  }
  return { columns, rows, cellWidth, cellHeight, fontSize, glyphs, tones, lights };
}
