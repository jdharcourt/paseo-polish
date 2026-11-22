import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["index.client.tsx"], bundle: true, write: false, format: "esm", platform: "node",
  plugins: [{
    name: "host",
    setup(build) {
      build.onResolve({ filter: /^react-native$|^\.\/client\/(appearance|web|changes)$/ }, args => ({ path: args.path, namespace: "test" }));
      build.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({
        contents: path === "react-native"
          ? 'export const Platform = { get OS() { return globalThis.testPlatform; } };'
          : path.endsWith("appearance")
            ? 'export const AppearanceItem=()=>null; export const AppearanceScreen=()=>null; export const AppearanceSettings=()=>null;'
            : path.endsWith("changes")
              ? 'export const registerChanges=()=>()=>{};'
              : 'export const getAppearance=()=>({values:{scheme:"graphite"}}); export const subscribeAppearance=()=>()=>{}; export const mountAppearance=()=>()=>{};',
      }));
    },
  }],
});
const { default: contribute } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

for (const platform of ["ios", "android", "web"]) {
  test(`${platform} registers its supported palettes and releases them on unload`, () => {
    globalThis.testPlatform = platform;
    const themes = [], removed = [];
    const cleanup = contribute({
      addTheme(theme) { themes.push(theme); return () => removed.push(theme.id); },
      addSettingsScreen() {}, addScreen() {}, addSidebarFooterItem() {}, addCommandCenterItem() {}, addSlashCommand() {},
    });
    assert.deepEqual(themes.map(theme => theme.id), platform === "web" ? ["polish"] : ["polish", "charcoal", "paper"]);
    assert.equal(themes[0].colors.background, "#1c1c1c");
    if (platform !== "web") {
      assert.equal(themes[1].colors.background, "#1c1b19");
      assert.equal(themes[2].appearance, "light");
      assert.equal(themes[2].colors.background, "#f7f6f2");
    }
    cleanup();
    assert.deepEqual(removed.sort(), themes.map(theme => theme.id).sort());
  });
}
