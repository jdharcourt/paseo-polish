# Space ASCII wallpapers

Four 3840 × 2160 JPEG wallpapers rendered from NASA photographs using a 640 × 240 grid of real monospaced ASCII characters. Each also has a matching plain-text `.txt` export. The photographs fill the frame. The plugin also bundles the original luminance field, allowing characters to be redrawn at different sizes with optional animation and cursor interaction. The original photographs are cached locally and excluded from Git and the plugin package.

| Wallpaper | Source and credit | Exports |
| --- | --- | --- |
| Lunar terrain | [Hayn Crater](https://images.nasa.gov/details/GSFC_20171208_Archive_e001225), NASA / GSFC / Arizona State University | [JPEG](lunar.jpg), [ASCII text](lunar.txt) |
| Saturn rings | [The Day the Earth Smiled](https://images.nasa.gov/details/PIA17172), NASA / JPL-Caltech / SSI | [JPEG](saturn.jpg), [ASCII text](saturn.txt) |
| Whirlpool galaxy | [Whirlpool Galaxy](https://images.nasa.gov/details/PIA04230), NASA and the Hubble Heritage Team (STScI/AURA), acknowledgment N. Scoville (Caltech) and T. Rector (NOAO) | [JPEG](galaxy.jpg), [ASCII text](galaxy.txt) |
| Pillars of Creation | [Hubble Goes High Def](https://images.nasa.gov/details/GSFC_20171208_Archive_e000842), NASA / ESA / Hubble Heritage Team (STScI/AURA) | [JPEG](nebula.jpg), [ASCII text](nebula.txt) |

The dark character-grid treatment is inspired by [Kailash's reference](https://x.com/kail_designs/status/2121211241201111213). The reference artwork is not bundled or copied into the plugin. No image-generation API was used for the final assets.

Run `npm run backgrounds` to regenerate the JPEGs, text exports, and bundled catalog. The script uses Menlo on macOS or the bundled Geist Mono elsewhere and downloads missing source photographs from NASA over HTTPS. The finished catalog is embedded in the client bundle; selecting a background makes no external requests and stores only the selection ID.
