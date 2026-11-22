Paseo Polish adds a Hoplite-inspired interface with Geist typography, rounded buttons and text fields, Graphite, Charcoal, and Paper color schemes, and full-width left-aligned conversations.

Four bundled space backgrounds render detailed ASCII directly from NASA photograph luminance: Lunar terrain, Saturn rings, Whirlpool galaxy, and Pillars of Creation. Artwork fills the chat pane. Adjust character size from 4 to 20 pixels, zoom the artwork separately, or enable ambient animation and cursor interaction. Motion pauses when hidden or offscreen and respects the system's reduced-motion preference. The background does not intercept chat input or scrolling. Animation and cursor interaction are off by default.

Open Paseo Polish from the sidebar, search for “Customize chat appearance” in the Command Center, or submit `/appearance`. Select Paseo Polish once in Settings → Appearance, then change color schemes in the plugin menu.

Requires Paseo 0.17.1 or newer. Layout and effects work in desktop and web; native mobile retains its native chat layout and supports the contributed theme. Internal desktop/web selectors may need updates in later Paseo versions.

Upload a JPEG, PNG, or WebP image up to 8 MB and 40 megapixels for a custom photographic background. Images are validated, resized to at most 4096 pixels, and re-encoded locally as JPEG. Switching presets retains your uploaded image. Show wallpaper can turn the background off without deleting it. Character sizing and motion apply to the built-in ASCII presets.

Images and preferences are stored in this app or browser's local storage and do not sync between devices. They are not sent to a daemon, agent provider, or image service. Other trusted code running in the same app can access that local storage. Checkout inspection runs on the daemon using Git and the authenticated GitHub CLI.

Turn UI polish off to restore the standard layout while retaining preferences. Reset appearance deletes the uploaded image and restores defaults. Disabling or removing the plugin removes its styles; local preferences remain until reset or site storage is cleared.

## Changes and pull requests

The Changes & PR panel opens automatically on wide layouts when the active workspace has changes or a verified pull request. It reads the actual checkout through the daemon, verifies the PR head repository and branch, and refreshes every three seconds. PR discovery refreshes every 30 seconds. The header button reopens the panel after a manual close. Compact and native clients use that button. No agent instructions or built-in UI selectors are required.

New task worktrees automatically become their parent chat’s checkout target through plugin-owned workspace metadata. A chat with one existing registered task worktree in the same project follows that worktree. An explicit target must be a registered direct child; unrelated workspaces are rejected. Other checkouts are never inferred from PR links in conversation text. PR diffs remain available after merge; local modifications and untracked files are shown separately. Local HEAD mismatches and GitHub lookup errors are displayed explicitly. Only GitHub PRs are supported and the daemon needs Git and authenticated `gh` on its PATH. Git refs, branches, agent placement, and the app source are unchanged.

Each diff preview is limited to 200,000 characters. Untracked previews include at most 100 regular files, with a 32 KB preview limit per file; binary files are identified without rendering their contents. The panel reports omitted content. The daemon sends checkout contents only to connected plugin clients; local changes are not uploaded to GitHub or sent to an agent.
