Paseo Polish adds a Hoplite-inspired interface with Geist typography, rounded buttons and text fields, Graphite, Charcoal, and Paper color schemes, and full-width left-aligned conversations.

Four bundled space backgrounds render detailed ASCII directly from NASA photograph luminance: Lunar terrain, Saturn rings, Whirlpool galaxy, and Pillars of Creation. Artwork fills the chat pane. Adjust character size from 4 to 20 pixels, zoom the artwork separately, or enable ambient animation and cursor interaction. Motion pauses when hidden or offscreen and respects the system's reduced-motion preference. The background does not intercept chat input or scrolling. Selecting a preset enables animation and cursor interaction; both can be switched off. Sixteen procedural scenes inspired by the Devault ASCII library generate live character fields with the same cursor physics. Backgrounds also appear before a chat starts.

Open Paseo Polish from the sidebar, search for “Customize chat appearance” in the Command Center, or submit `/appearance`. Select Paseo Polish once in Settings → Appearance, then change color schemes in the plugin menu.

Requires Paseo 0.17.1 or newer. Layout and effects work in desktop and web; native mobile retains its native chat layout and supports the contributed theme. Internal desktop/web selectors may need updates in later Paseo versions.

Upload a JPEG, PNG, or WebP image up to 8 MB and 40 megapixels for a custom photographic background. Images are validated, resized to at most 4096 pixels, and re-encoded locally as JPEG. Switching presets retains your uploaded image. Show wallpaper can turn the background off without deleting it. Character sizing and motion apply to the built-in ASCII presets.

Images and preferences are stored in this app or browser's local storage and do not sync between devices. They are not sent to a daemon, agent provider, or image service. Other trusted code running in the same app can access that local storage. Checkout inspection runs on the daemon using Git and the authenticated GitHub CLI.

Turn UI polish off to restore the standard layout while retaining preferences. Reset appearance deletes the uploaded image and restores defaults. Disabling or removing the plugin removes its styles; local preferences remain until reset or site storage is cleared.

## Changes and pull requests

Polish adds separate Changes and Pull request tabs to the Explorer. On wide layouts, the PR window opens automatically when GitHub reports a verified PR for the active task checkout. It follows new PR identities without repeatedly stealing focus; the header button reopens a manually closed window. Compact clients use that button.

The PR window follows Paseo’s built-in PR layout: View and Refresh controls, title and state, repository, check summary, filterable check rows with workflow names and durations, and expandable comment and review activity. Add to chat inserts quoted external content into the focused composer only when clicked; it never sends a prompt or posts a GitHub comment. Approval counts include the latest meaningful review per author on the accepted PR head. This is a plugin-owned window using public SDK registrations; it does not modify Paseo’s app source or depend on internal DOM selectors.

Checkout inspection runs every three seconds; GitHub discovery is cached for ten seconds and open PR details refresh every fifteen seconds. Manual Refresh bypasses discovery caching. A changed head hides stale check and activity results until identity catches up. Missing authentication, unavailable checks, and preview limits are shown explicitly.

New registered task worktrees automatically become their parent chat’s checkout target through plugin-owned metadata. Existing chats with one registered task worktree in the same project follow it. An explicit target must be a registered direct child; unrelated targets are rejected. Git refs and agent placement are unchanged. PR discovery verifies the head repository and branch. Merged PR diffs remain available; local modifications and untracked files appear separately in Changes.

The daemon requires Git and authenticated `gh` on its PATH. Only GitHub PRs are supported. Diff previews are limited to 200,000 characters per section; untracked previews include up to 100 regular files with a 32 KB limit per file. PR details show up to 500 checks and the latest 100 activity records with 20,000 characters per body; Add all to chat is limited to 32,000 characters. Truncation is reported. The daemon sends checkout contents to connected plugin clients, and does not upload local changes to GitHub or send them to an agent automatically.

ASCII color controls switch between monochrome and the Devault website’s Devault, Console, Amber, Glacier, Dusk, Electric, or Mono palettes. The palette applies to space and procedural scenes in both renderers. Additional live scenes include aurora curtains, plasma currents, a rotating torus, warped lattice, solar corona, and orbital traces.

Palette stops and the Classic glyph ramp match Devault’s generator settings. The procedural scene compositions are original interpretations, not exact copies of the library’s source artwork.
