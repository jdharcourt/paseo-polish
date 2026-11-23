import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const bundle = await build({
  stdin: {
    contents:
      'export * from "./client/web"; export * from "./client/preferences";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "platform",
      setup(build) {
        build.onResolve({ filter: /^react-native$/ }, () => ({
          path: "platform",
          namespace: "test",
        }));
        build.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents:
            'export const Platform = { get OS() { return globalThis.testPlatform || "web"; } };',
        }));
      },
    },
  ],
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
let dom;
let cleanup;

beforeEach(() => {
  globalThis.testPlatform = "web";
  dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    url: "https://paseo.test",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.MutationObserver = dom.window.MutationObserver;
  cleanup = api.mountAppearance();
});
afterEach(() => {
  cleanup();
  dom.window.close();
});

test("applies saved layout again after reload and removes styles on teardown", () => {
  api.saveAppearance({ width: "wide", spacing: "compact" });
  cleanup();
  assert.equal(document.querySelector("style"), null);
  assert.equal(
    document.documentElement.hasAttribute("data-paseo-polish"),
    false,
  );
  cleanup = api.mountAppearance();
  assert.equal(api.getAppearance().values.width, "wide");
  assert.match(document.querySelector("style").textContent, /--content-max-width:1080px/);
});

test("rejects remote URLs, SVG, CSS injection, and invalid option values", () => {
  for (const image of [
    "https://example.com/bg.jpg",
    "data:image/svg+xml;base64,PHN2Zz4=",
    'data:image/jpeg;base64,/9j/\");body{display:none}',
  ]) {
    assert.throws(() => api.saveAppearance({ image }));
  }
  assert.throws(() => api.saveAppearance({ visibility: 101 }));
  assert.throws(() => api.saveAppearance({ position: "left;display:none" }));
  assert.throws(() => api.saveAppearance({ width: "500px" }));
  assert.equal(api.getAppearance().values.image, null);
});

test("preserves the last saved image when storage is full", () => {
  api.saveAppearance({ image: "data:image/jpeg;base64,/9j/AA==" });
  const before = api.getAppearance();
  dom.window.Storage.prototype.setItem = () => {
    throw new Error("quota");
  };
  assert.throws(
    () => api.saveAppearance({ image: null }),
    /Free browser storage/,
  );
  assert.equal(api.getAppearance(), before);
});

test("corrupt preferences disable polish until explicitly reset", () => {
  window.localStorage.setItem(
    "paseo-polish:v1",
    '{"image":"https://evil.test"}',
  );
  window.dispatchEvent(
    new dom.window.StorageEvent("storage", { key: "paseo-polish:v1" }),
  );
  assert.equal(api.getAppearance().values.enabled, false);
  assert.match(api.getAppearance().error, /Reset appearance/);
  api.saveAppearance(api.preferencesSchema.parse({}));
  assert.equal(api.getAppearance().values.enabled, true);
  assert.equal(api.getAppearance().error, "");
});

test("keeps open windows synchronized and unsubscribes on teardown", () => {
  let changes = 0;
  const unsubscribe = api.subscribeAppearance(() => changes++);
  window.localStorage.setItem(
    "paseo-polish:v1",
    JSON.stringify({ width: "full" }),
  );
  window.dispatchEvent(
    new dom.window.StorageEvent("storage", { key: "paseo-polish:v1" }),
  );
  assert.equal(api.getAppearance().values.width, "full");
  assert.equal(changes, 1);
  unsubscribe();
  cleanup();
  window.dispatchEvent(
    new dom.window.StorageEvent("storage", { key: "paseo-polish:v1" }),
  );
  assert.equal(changes, 1);
});

test("disabled polish removes chat overrides but retains the selected image", () => {
  api.saveAppearance({
    enabled: false,
    image: "data:image/jpeg;base64,/9j/AA==",
  });
  assert.equal(api.appearanceCss(api.getAppearance().values), "");
  assert.equal(
    api.getAppearance().values.image,
    "data:image/jpeg;base64,/9j/AA==",
  );
  api.saveAppearance({ enabled: true, wallpaperEnabled: true });
  assert.match(
    document.querySelector("style").textContent,
    /background-image:url/,
  );
});

test("validates file signatures independently of extension or MIME", () => {
  assert.equal(
    api.detectImageType(new Uint8Array([255, 216, 255, 224])),
    "image/jpeg",
  );
  assert.equal(
    api.detectImageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.equal(
    api.detectImageType(
      new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
    ),
    "image/webp",
  );
  assert.throws(
    () => api.detectImageType(new Uint8Array([60, 115, 118, 103])),
    /JPEG, PNG, or WebP/,
  );
  assert.throws(() => api.detectImageType(new Uint8Array()));
});

test("picker cancellation and plugin unload release the pending input", async () => {
  const cancelled = api.chooseBackground();
  document.querySelector("input").dispatchEvent(new dom.window.Event("cancel"));
  await cancelled;
  assert.equal(document.querySelector("input"), null);
  const unloaded = api.chooseBackground();
  cleanup();
  await unloaded;
  assert.equal(document.querySelector("input"), null);
  assert.equal(api.getAppearance().values.image, null);
});

test("rejects oversized uploads and mislabeled file contents", async () => {
  for (const [file, message] of [
    [{ size: 9 * 1024 * 1024, type: "image/png" }, /smaller than 8 MB/],
    [
      {
        size: 20,
        type: "image/png",
        arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer,
      },
      /do not match/,
    ],
    [{ size: 20, type: "image/svg+xml" }, /JPEG, PNG, or WebP/],
  ]) {
    const chosen = api.chooseBackground();
    const input = document.querySelector("input");
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new dom.window.Event("change"));
    await assert.rejects(chosen, message);
    assert.equal(api.getAppearance().values.image, null);
  }
});

test("native clients never access browser APIs", async () => {
  globalThis.testPlatform = "ios";
  const nativeCleanup = api.mountAppearance();
  api.saveAppearance({ width: "wide" });
  assert.equal(api.getAppearance().values.width, "full");
  await assert.rejects(api.chooseBackground(), /desktop and web/);
  nativeCleanup();
});

test("theme colors cannot inject stylesheet rules", () => {
  api.setAppearanceTheme("#1c1b19", "#c5b792");
  assert.match(
    document.querySelector("style").textContent,
    /--polish-surface:#1c1b19/,
  );
  const before = document.querySelector("style").textContent;
  api.setAppearanceTheme("red;}body{display:none", "#ffffff");
  assert.equal(document.querySelector("style").textContent, before);
});

test("wallpaper spans each chat and composer without coloring neighboring panes", async () => {
  document.body.innerHTML =
    '<div id="workspace"><div id="chat-a"><div><div data-testid="agent-chat-scroll"></div></div><div data-testid="message-input-root"></div></div><div id="terminal">Terminal</div><div id="chat-b"><div><div data-testid="agent-chat-scroll"></div></div><div data-testid="message-input-root"></div></div></div>';
  await new Promise(setImmediate);
  assert.equal(document.querySelectorAll("[data-paseo-polish-chat]").length, 2);
  assert.equal(
    document.querySelector("#chat-a").hasAttribute("data-paseo-polish-chat"),
    true,
  );
  assert.equal(
    document.querySelector("#chat-b").hasAttribute("data-paseo-polish-chat"),
    true,
  );
  assert.equal(
    document.querySelector("#workspace").hasAttribute("data-paseo-polish-chat"),
    false,
  );
  assert.equal(
    document.querySelector("#terminal").hasAttribute("data-paseo-polish-chat"),
    false,
  );
  cleanup();
  assert.equal(document.querySelectorAll("[data-paseo-polish-chat]").length, 0);
});

test("migrates old centered wallpaper settings once while retaining the uploaded image", () => {
  cleanup();
  const image = "data:image/jpeg;base64,/9j/AA==";
  window.localStorage.setItem("paseo-polish:v1", JSON.stringify({ width: "focused", spacing: "comfortable", visibility: 100, image }));
  cleanup = api.mountAppearance();
  assert.equal(api.getAppearance().values.width, "full");
  assert.equal(api.getAppearance().values.spacing, "compact");
  assert.equal(api.getAppearance().values.wallpaperEnabled, false);
  assert.equal(api.getAppearance().values.image, image);
  assert.doesNotMatch(document.querySelector("style").textContent, /background-image:url/);
  api.saveAppearance({ width: "wide", wallpaperEnabled: true });
  cleanup();
  cleanup = api.mountAppearance();
  assert.equal(api.getAppearance().values.width, "wide");
  assert.equal(api.getAppearance().values.wallpaperEnabled, true);
});

test("space preset selection survives reload without replacing a custom upload", () => {
  const image = "data:image/jpeg;base64,/9j/AA==";
  api.saveAppearance({ image, background: "saturn", wallpaperEnabled: true });
  assert.equal(api.getAppearance().values.image, image);
  const css = api.appearanceCss(api.getAppearance().values);
  assert.match(css, /background-image:url/);
  assert.doesNotMatch(css, /background-image:url\("data:image\/jpeg;base64,\/9j\/AA==/);
  cleanup();
  cleanup = api.mountAppearance();
  assert.equal(api.getAppearance().values.background, "saturn");
  api.saveAppearance({ background: "custom" });
  assert.match(api.appearanceCss(api.getAppearance().values), /background-image:url\("data:image\/jpeg;base64,\/9j\/AA==/);
  assert.throws(() => api.saveAppearance({ background: "https://evil.test/image" }));
  api.saveAppearance({ wallpaperEnabled: false });
  assert.doesNotMatch(api.appearanceCss(api.getAppearance().values), /background-image:url/);
});

test("ASCII settings persist and reject invalid sizes and animation flags", () => {
  api.saveAppearance({ characterSize: 12, backgroundScale: 150, animated: true, interactive: true });
  for (const patch of [{ characterSize: 3 }, { characterSize: 21 }, { backgroundScale: 99 }, { backgroundScale: 201 }, { animated: "yes" }]) assert.throws(() => api.saveAppearance(patch));
  cleanup();
  cleanup = api.mountAppearance();
  const values = api.getAppearance().values;
  assert.equal(values.characterSize, 12);
  assert.equal(values.backgroundScale, 150);
  assert.equal(values.animated, true);
  assert.equal(values.interactive, true);
});

test("cursor controls migrate existing preferences, persist, and reject invalid values", () => {
  assert.equal(api.getAppearance().values.cursorForce, "push");
  assert.equal(api.getAppearance().values.cursorStrength, 50);
  assert.equal(api.getAppearance().values.cursorTrail, 50);
  assert.equal(api.getAppearance().values.cursorBounce, 0);
  api.saveAppearance({ cursorForce: "pull", cursorStrength: 100, cursorTrail: 25, cursorBounce: 75 });
  for (const patch of [{ cursorForce: "spin" }, { cursorStrength: -1 }, { cursorStrength: 25.5 }, { cursorTrail: 101 }, { cursorBounce: false }]) assert.throws(() => api.saveAppearance(patch));
  cleanup();
  cleanup = api.mountAppearance();
  const values = api.getAppearance().values;
  assert.equal(values.cursorForce, "pull");
  assert.equal(values.cursorStrength, 100);
  assert.equal(values.cursorTrail, 25);
  assert.equal(values.cursorBounce, 75);
});

 test("wallpaper mounts before a chat exists in the workspace composer", async () => {
  document.body.innerHTML = '<div><aside data-testid="sidebar-nav-scroll"></aside><main><div id="empty"><div data-testid="message-input-root"></div></div></main></div>';
  await new Promise(setImmediate);
  assert.equal(document.querySelector("main").hasAttribute("data-paseo-polish-chat"), true);
  assert.equal(document.querySelector("aside").hasAttribute("data-paseo-polish-chat"), false);
 });

 test("ASCII color controls persist and reject unsupported palettes", () => {
  api.saveAppearance({ colorEnabled: true, asciiColor: "rose" });
  cleanup();
  cleanup = api.mountAppearance();
  assert.equal(api.getAppearance().values.colorEnabled, true);
  assert.equal(api.getAppearance().values.asciiColor, "sunset");
  assert.equal(api.preferencesSchema.safeParse({ asciiColor: "invalid" }).success, false);
  api.saveAppearance({ colorEnabled: false });
  assert.equal(api.getAppearance().values.asciiColor, "sunset");
 });

test("old tint names migrate to website palettes", () => {
  assert.equal(api.preferencesSchema.parse({ asciiColor: "moss" }).asciiColor, "phosphor");
  assert.equal(api.preferencesSchema.parse({ asciiColor: "violet" }).asciiColor, "devault");
});
