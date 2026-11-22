Paseo Polish adds a Hoplite-inspired interface with Geist typography, rounded buttons and text fields, Graphite, Charcoal, and Paper color schemes, and full-width left-aligned conversations.

Four bundled space backgrounds render detailed ASCII directly from NASA photograph luminance: Lunar terrain, Saturn rings, Whirlpool galaxy, and Pillars of Creation. Artwork fills the chat pane. Adjust character size from 4 to 20 pixels, zoom the artwork separately, or enable ambient animation and cursor interaction. Motion pauses when hidden or offscreen and respects the system's reduced-motion preference. The background does not intercept chat input or scrolling. Animation and cursor interaction are off by default.

Open Paseo Polish from the sidebar, search for “Customize chat appearance” in the Command Center, or submit `/appearance`. Select Paseo Polish once in Settings → Appearance, then change color schemes in the plugin menu.

Requires Paseo 0.17.1 or newer. Layout and effects work in desktop and web; native mobile retains its native chat layout and supports the contributed theme. Internal desktop/web selectors may need updates in later Paseo versions.

Upload a JPEG, PNG, or WebP image up to 8 MB and 40 megapixels for a custom photographic background. Images are validated, resized to at most 4096 pixels, and re-encoded locally as JPEG. Switching presets retains your uploaded image. Show wallpaper can turn the background off without deleting it. Character sizing and motion apply to the built-in ASCII presets.

Images and preferences are stored in this app or browser's local storage and do not sync between devices. They are not sent to a daemon, agent provider, or image service. Other trusted code running in the same app can access that local storage. The plugin has no backend component or runtime downloads.

Turn UI polish off to restore the standard layout while retaining preferences. Reset appearance deletes the uploaded image and restores defaults. Disabling or removing the plugin removes its styles; local preferences remain until reset or site storage is cleared.