export const asciiScenes = {
  devaultRing: "Orbit rings",
  devaultDiscs: "Dither discs",
  devaultLilac: "Lilac flow",
  devaultMotion: "Rolling discs",
  ribbons: "Woven ribbons",
  waves: "Interference waves",
  terrain: "Contour terrain",
  vortex: "Spiral vortex",
  tunnel: "Infinite tunnel",
  rain: "ASCII rain",
};

export function updateAsciiScene(field: Uint8Array, scene: string, time: number) {
  for (let y = 0; y < 432; y += 4) {
    for (let x = 0; x < 768; x += 4) {
      const u = (x - 384) / 432;
      const v = (y - 216) / 432;
      const radius = Math.hypot(u, v);
      const angle = Math.atan2(v, u);
      let signal = 0;
      switch (scene) {
        case "devaultRing": {
          const ring = Math.hypot(u, v * 2.8);
          signal = Math.exp(-(((ring - .48) * 10) ** 2)) * (.55 + .4 * Math.sin(ring * 180 - time * 2 + angle * 3));
          break;
        }
        case "devaultDiscs": {
          const dx = ((u + 2 + time * .06) % .38) - .19;
          const dy = ((v + 2 + Math.sin(time * .4) * .08) % .38) - .19;
          const disc = Math.hypot(dx, dy);
          signal = Math.max(0, 1 - disc / .17) * (.6 + .4 * Math.cos(disc * 120 - time * 3));
          break;
        }
        case "devaultMotion": {
          for (let disc = 0; disc < 3; disc++) {
            const phase = disc * Math.PI * 2 / 3 + time * .3;
            const distance = Math.hypot(u - Math.cos(phase) * .32, v - Math.sin(phase) * .23);
            signal = Math.max(signal, Math.exp(-((distance * 4) ** 2)) * (.5 + .5 * Math.cos(distance * 100 - time * 2)));
          }
          break;
        }
        case "devaultLilac":
          signal = (.5 + .5 * Math.sin(u * 9 + Math.sin(v * 8 + time * .6) * 2 + time * .5)) ** 3;
          break;
        case "ribbons":
          signal = Math.exp(-((Math.sin(v * 16 + Math.sin(u * 6 + time * .4) * 2) * 4) ** 2)) * (.5 + .4 * Math.cos(u * 9 - time));
          break;
        case "waves":
          signal = (.5 + .5 * Math.sin(Math.hypot(u - .35, v) * 45 - time * 2) * Math.sin(Math.hypot(u + .35, v) * 45 - time * 1.7)) ** 2;
          break;
        case "terrain": {
          const elevation = Math.sin(u * 6 + time * .12) * .4 + Math.cos(v * 8) * .3 + Math.sin((u + v) * 13 + time * .2) * .15;
          signal = Math.exp(-((Math.sin(elevation * 24) * 5) ** 2)) * .85;
          break;
        }
        case "vortex":
          signal = (.5 + .5 * Math.sin(angle * 7 + radius * 32 - time * 1.4)) ** 5 * Math.exp(-radius * 1.5);
          break;
        case "tunnel":
          signal = (.5 + .5 * Math.cos(Math.log(radius + .03) * 24 - time * 3)) ** 8 * (.55 + .4 * Math.sin(angle * 8));
          break;
        case "rain": {
          const column = Math.floor(x / 12);
          const speed = .12 + (Math.sin(column * 127.1) * .5 + .5) * .3;
          const trail = (((y / 432 - time * speed + Math.sin(column * 311.7)) % 1 + 1) % 1);
          signal = Math.exp(-trail * 12) * (.4 + .6 * Math.abs(Math.sin(column * 17 + Math.floor(y / 12) * 53)));
          break;
        }
      }
      const tone = Math.round(Math.max(0, Math.min(1, signal)) * 255);
      for (let row = 0; row < 4; row++) field.fill(tone, (y + row) * 768 + x, (y + row) * 768 + x + 4);
    }
  }
}
