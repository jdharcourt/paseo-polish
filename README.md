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
- **React to cursor:** local ASCII displacement around the pointer. Choose **Push away** or **Pull in**, **Gentle / Normal / Strong** strength, **Off / Short / Medium / Long** trails, and **Off / Soft / Springy** bounce. Controls apply immediately, stay on this device, and work independently of scene animation.
- **Image visibility** and **Image position:** adjust strength and vertical crop.

Animation pauses for hidden or offscreen panes. Motion and cursor displacement respect the system's reduced-motion preference. Wallpaper canvases do not intercept clicks, typing, selection, or scrolling. Effects start off and apply to the built-in ASCII presets. Scene-specific motion uses a local WebGL glyph renderer, preserving upright characters as the scene changes. Browsers without WebGL retain the detailed 2D artwork with gentle camera motion.

You can also upload a JPEG, PNG, or WebP up to 8 MB and 40 megapixels. Custom images retain their photographic appearance. File signatures and MIME types are checked before decoding; images are resized to at most 4096 pixels and re-encoded locally as JPEG. Changing presets keeps your uploaded image saved. **Show wallpaper** switches to a plain surface without deleting it.

Images and preferences stay in this app or browser's local storage and do not sync between devices. They are not sent to the daemon, an agent, or an image service. Other trusted code running in the same app can access that storage. Checkout inspection runs on the daemon using Git and the authenticated GitHub CLI.

Cursor interaction is inspired by [Insomnia](https://getinsomnia.app/). Motion studies include [ASCII Magic’s Cosmos collection](https://www.ascii-magic.com/ascii/category/cosmos) and [Astro ASCII](https://github.com/kenny2077/astro-ascii). The effects are artistic, time-compressed interpretations of space imagery, rather than astronomical simulations.

## Interface

Buttons and tabs use Hoplite's 10-pixel control radius, with rounded command/output containers, inset text fields, full-width left-aligned conversations, and a 248-pixel desktop sidebar. **UI polish** restores the standard layout while retaining preferences when switched off. **Reset appearance** restores defaults and deletes the uploaded image. Removing the plugin removes its styling; device-local preferences remain until reset or site storage is cleared.

Geist and Geist Mono are bundled under the [SIL Open Font License](client/Geist-OFL.txt). Space-image credits and 4K/text exports are in [assets/space](assets/space/README.md).

Layout, images, and ASCII animation work in desktop and mobile browsers, including phone-sized layouts. Phone and touch layouts use 44-pixel controls and 16-pixel input text. Choose a background separately in each browser; appearance does not sync between devices.

Native iOS and Android support Graphite, Charcoal, and Paper through Settings → Appearance: choose **Paseo Polish** (Graphite), **Paseo Polish · Charcoal**, or **Paseo Polish · Paper**. The native app saves this choice. Native chat wallpapers and global button/layout styling are not exposed by the current plugin API; the plugin links to the mobile web app for the full appearance. Native device rendering has not been verified on hardware. Styling targets internal Paseo selectors verified against 0.17.1; later versions may require updates.

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

## Changes and pull requests

The Changes & PR panel opens automatically on wide layouts when the active workspace has changes or a verified pull request. It reads the actual checkout through the daemon, verifies the PR head repository and branch, and refreshes every three seconds. PR discovery refreshes every 30 seconds. The header button reopens the panel after a manual close. Compact and native clients use that button. No agent instructions or built-in UI selectors are required.

New task worktrees automatically become their parent chat’s checkout target through plugin-owned workspace metadata. A chat with one existing registered task worktree in the same project follows that worktree. An explicit target must be a registered direct child; unrelated workspaces are rejected. Other checkouts are never inferred from PR links in conversation text. PR diffs remain available after merge; local modifications and untracked files are shown separately. Local HEAD mismatches and GitHub lookup errors are displayed explicitly. Only GitHub PRs are supported and the daemon needs Git and authenticated `gh` on its PATH. Git refs, branches, agent placement, and the app source are unchanged.

Each diff preview is limited to 200,000 characters. Untracked previews include at most 100 regular files, with a 32 KB preview limit per file; binary files are identified without rendering their contents. The panel reports omitted content. The daemon sends checkout contents only to connected plugin clients; local changes are not uploaded to GitHub or sent to an agent.
