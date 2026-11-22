# Paseo Polish

A Paseo plugin with a Hoplite-inspired interface, Geist typography, rounded controls, three color schemes, custom chat images, and interactive space ASCII backgrounds.

![Paseo Polish appearance settings](assets/interface.png)

## Install

Requires Paseo 0.17.1 or newer. Install from GitHub:

```sh
paseo plugin add git:jdharcourt/paseo-polish
```

Enable plugins in Settings → Plugins. Plugins are trusted, unsandboxed code. Open **Paseo Polish** in the sidebar or use `/appearance`. Select **Paseo Polish** once under Settings → Appearance, then switch Graphite, Charcoal, or Paper in the plugin menu.

## Backgrounds

Choose Lunar terrain, Saturn rings, Whirlpool galaxy, or Pillars of Creation. Each is drawn from bundled NASA photograph luminance, covers the full chat pane, and remains crisp when resized.

- **Character size:** 4–20 px, from fine detail to large visible glyphs.
- **Artwork scale:** fill the pane, or zoom to 125%, 150%, or 200% independently of character size.
- **Animate ASCII:** steady lunar camera drift, circulating Saturn ring detail, differential galaxy rotation, and layered nebula gas.
- **React to cursor:** a smoothly eased viewpoint shift with depth parallax.
- **Image visibility** and **Image position:** adjust strength and vertical crop.

Animation pauses for hidden or offscreen panes. Motion and cursor displacement respect the system's reduced-motion preference. Wallpaper canvases do not intercept clicks, typing, selection, or scrolling. Effects start off and apply to the built-in ASCII presets. Scene-specific motion uses a local WebGL glyph renderer, preserving upright characters as the scene changes. Browsers without WebGL retain the detailed 2D artwork with gentle camera motion.

You can also upload a JPEG, PNG, or WebP up to 8 MB and 40 megapixels. Custom images retain their photographic appearance. File signatures and MIME types are checked before decoding; images are resized to at most 4096 pixels and re-encoded locally as JPEG. Changing presets keeps your uploaded image saved. **Show wallpaper** switches to a plain surface without deleting it.

Images and preferences stay in this app or browser's local storage and do not sync between devices. They are not sent to the daemon, an agent, or an image service. Other trusted code running in the same app can access that storage. This plugin has no backend component or runtime downloads.

Motion studies include [ASCII Magic’s Cosmos collection](https://www.ascii-magic.com/ascii/category/cosmos) and [Astro ASCII](https://github.com/kenny2077/astro-ascii). The effects are artistic, time-compressed interpretations of space imagery, rather than astronomical simulations.

## Interface

Buttons and tabs use Hoplite's 10-pixel control radius, with rounded command/output containers, inset text fields, full-width left-aligned conversations, and a 248-pixel desktop sidebar. **UI polish** restores the standard layout while retaining preferences when switched off. **Reset appearance** restores defaults and deletes the uploaded image. Removing the plugin removes its styling; device-local preferences remain until reset or site storage is cleared.

Geist and Geist Mono are bundled under the [SIL Open Font License](client/Geist-OFL.txt). Space-image credits and 4K/text exports are in [assets/space](assets/space/README.md).

Layout and effects work in desktop and web. Native mobile clients retain their native chat layout and support the contributed theme. Styling targets internal Paseo selectors verified against 0.17.1; later versions may require updates.

## Development

```sh
git clone https://github.com/jdharcourt/paseo-polish.git
cd paseo-polish
npm ci
npm run typecheck
npm test
paseo plugin install "$PWD"
```

After editing, run the checks and `paseo plugin reload polish`. `npm run backgrounds` regenerates the bundled luminance, thumbnails, 3840 × 2160 wallpapers, text exports, and contact sheet. It uses the system Menlo font on macOS, or the bundled Geist Mono elsewhere, and downloads missing source photographs from NASA over HTTPS. Development source-photo caches are ignored by Git.