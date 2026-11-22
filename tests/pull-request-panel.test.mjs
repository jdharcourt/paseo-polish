import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { build } from "esbuild";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await build({
  entryPoints: ["client/pull-request.tsx"],
  outfile: "test-results/pr-panel.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  plugins: [
    {
      name: "host",
      setup(build) {
        build.onResolve(
          { filter: /^(@getpaseo\/plugin\/client(?:\/ui)?|react-native)$/ },
          ({ path }) => ({ path, namespace: "host" }),
        );
        build.onLoad({ filter: /.*/, namespace: "host" }, ({ path }) => ({
          contents:
            path === "react-native"
              ? 'export const Pressable="Pressable", ScrollView="ScrollView", Text="Text", View="View";'
              : path.endsWith("/ui")
                ? 'export const Icon="Icon", Markdown="Markdown", ScrollView="ScrollView";'
                : "export const useRpc=()=>globalThis.readPr; export const useComposers=()=>globalThis.composers; export const openExternalUrl=async(url)=>globalThis.openedUrls.push(url);",
        }));
      },
    },
  ],
});
const { PullRequestView } = await import("../test-results/pr-panel.mjs");
const theme = {
  colors: {
    foreground: "#eeeeee",
    foregroundMuted: "#aaaaaa",
    surface0: "#191919",
    surface2: "#282828",
    border: "#333333",
    statusSuccess: "#6b9f7a",
    statusDanger: "#c57d78",
    statusWarning: "#bb9b65",
    accent: "#ad99bf",
  },
};
const pr = {
  number: 42,
  title: "Fix checkout discovery",
  url: "https://github.com/owner/project/pull/42",
  state: "MERGED",
  head: "abc123",
  base: "main",
};
const fixture = () => ({
  url: pr.url,
  head: pr.head,
  repository: "owner/project",
  reviewDecision: "APPROVED",
  checks: [
    {
      name: "Integration",
      workflow: "CI",
      url: "https://github.com/owner/project/actions/runs/1",
      state: "success",
      durationSeconds: 87,
    },
    {
      name: "Optional",
      workflow: "CI",
      url: "",
      state: "skipped",
      durationSeconds: null,
    },
  ],
  activity: [
    {
      id: "comment",
      author: "reviewer",
      body: "Check **this** change",
      url: pr.url,
      time: "2026-11-22T10:00:00Z",
      head: "",
      kind: "comment",
      state: "",
    },
  ],
  limited: false,
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

async function mount(data, onRefresh = async () => {}) {
  globalThis.readPr = async () => {
    if (data instanceof Error) throw data;
    return data;
  };
  globalThis.composers = [];
  globalThis.openedUrls = [];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(PullRequestView, {
          workspaceId: "task",
          theme,
          pr,
          onRefresh,
        }),
      ),
    );
    await tick();
  });
  await act(tick);
  return {
    renderer,
    close: async () => {
      await act(async () => renderer.unmount());
      client.clear();
    },
  };
}
const button = (renderer, label) =>
  renderer.root
    .findAllByType("Pressable")
    .find((element) => element.props.accessibilityLabel === label);

test("PR window shows real title, merged state, passed check durations, and activity", async () => {
  const { renderer, close } = await mount(fixture());
  const output = JSON.stringify(renderer.toJSON());
  assert.match(output, /Fix checkout discovery/);
  assert.match(output, /Merged/);
  assert.match(output, /All checks have passed/);
  assert.match(output, /Integration/);
  assert.match(output, /1m 27s/);
  assert.match(output, /reviewer/);
  assert.match(output, /Check \*\*this\*\* change/);
  assert.equal(renderer.root.findAllByType("Markdown").length, 0);
  await act(async () => button(renderer, "Toggle reviewer's activity comment").props.onPress());
  assert.equal(renderer.root.findAllByType("Markdown").length, 1);
  await act(async () => button(renderer, "Toggle reviewer's activity comment").props.onPress());
  assert.equal(renderer.root.findAllByType("Markdown").length, 0);
  await act(async () =>
    button(renderer, "View pull request on GitHub").props.onPress(),
  );
  assert.deepEqual(globalThis.openedUrls, [pr.url]);
  await close();
});

test("failed and pending checks are never presented as all passing and filters select their rows", async () => {
  const data = fixture();
  data.checks.push(
    {
      name: "Security scan",
      workflow: "CI",
      url: "",
      state: "failure",
      durationSeconds: 3,
    },
    {
      name: "Build waiting",
      workflow: "CI",
      url: "",
      state: "pending",
      durationSeconds: null,
    },
  );
  const { renderer, close } = await mount(data);
  assert.match(JSON.stringify(renderer.toJSON()), /Some checks have failed/);
  assert.match(JSON.stringify(renderer.toJSON()), /Security scan/);
  assert.doesNotMatch(
    JSON.stringify(renderer.toJSON()),
    /All checks have passed/,
  );
  await act(async () =>
    button(renderer, "Show pending checks").props.onPress(),
  );
  assert.match(JSON.stringify(renderer.toJSON()), /Build waiting/);
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Security scan/);
  await close();
});

test("activity is inserted as quoted external content only on an explicit click", async () => {
  const inserted = [];
  const { renderer, close } = await mount(fixture());
  assert.equal(
    button(renderer, "Add all PR activity to chat").props.disabled,
    true,
  );
  globalThis.composers = [{ insertText: (text) => inserted.push(text) }];
  await act(async () =>
    button(renderer, "Toggle pull request activity").props.onPress(),
  );
  await act(async () =>
    button(renderer, "Toggle pull request activity").props.onPress(),
  );
  assert.equal(inserted.length, 0);
  await act(async () =>
    button(renderer, "Add all PR activity to chat").props.onPress(),
  );
  assert.equal(inserted.length, 1);
  assert.match(inserted[0], /external content/);
  assert.match(inserted[0], /> reviewer commented:/);
  assert.match(inserted[0], /> Check \*\*this\*\* change/);
  await close();
});

test("stale PR heads and lookup failures hide checks and activity instead of showing old results", async () => {
  const data = fixture();
  data.head = "old-head";
  const stale = await mount(data);
  assert.match(JSON.stringify(stale.renderer.toJSON()), /PR head changed/);
  assert.doesNotMatch(
    JSON.stringify(stale.renderer.toJSON()),
    /All checks have passed/,
  );
  assert.doesNotMatch(
    JSON.stringify(stale.renderer.toJSON()),
    /Check \*\*this\*\* change/,
  );
  await stale.close();
  const failed = await mount(new Error("offline"));
  assert.match(JSON.stringify(failed.renderer.toJSON()), /could not be loaded/);
  assert.doesNotMatch(
    JSON.stringify(failed.renderer.toJSON()),
    /All checks have passed/,
  );
  await failed.close();
});

test("manual refresh invokes checkout discovery and refetches PR details", async () => {
  let refreshed = 0;
  const { renderer, close } = await mount(fixture(), async () => {
    refreshed++;
  });
  await act(async () => {
    await button(renderer, "Refresh pull request").props.onPress();
    await tick();
  });
  assert.equal(refreshed, 1);
  await close();
});
