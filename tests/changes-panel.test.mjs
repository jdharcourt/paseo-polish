import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { build } from "esbuild";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await build({
  entryPoints: ["client/changes.tsx"],
  outfile: "test-results/changes-panel.mjs",
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
                ? 'export const Icon="Icon", Markdown="Markdown";'
                : "export const useRpc=()=>globalThis.inspectCheckout; export const useComposers=()=>[]; export const useWorkspace=(id,select)=>select({branch:globalThis.branches[id]??null}); export const openExternalUrl=async()=>{};",
        }));
      },
    },
  ],
});
const { registerChanges, ChangesPanel } = await import(
  "../test-results/changes-panel.mjs"
);
const theme = {
  colors: {
    foreground: "#eeeeee",
    foregroundMuted: "#aaaaaa",
    surface0: "#191919",
    border: "#333333",
  },
};
const state = (workspaceId, number) => ({
  workspaceId,
  directory: `/checkout/${workspaceId}`,
  branch: "feat/task",
  head: "abcdef123456",
  base: "main",
  diff: "diff --git a/file b/file\n+correct diff",
  localDiff: "",
  files: ["file"],
  truncated: false,
  error: "",
  pullRequest: {
    number,
    title: `PR ${number}`,
    url: `https://github.com/owner/project/pull/${number}`,
    state: "OPEN",
    head: "abcdef123456",
    base: "main",
  },
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

test("header uses its SDK workspace context to open the plugin panel once without DOM selectors", async () => {
  const requests = [];
  const opened = [];
  const buttons = [];
  let released = 0;
  globalThis.branches = { correct: "feat/task" };
  globalThis.inspectCheckout = async ({ workspaceId }) => {
    requests.push(workspaceId);
    return state(workspaceId, 42);
  };
  const stop = registerChanges({
    addWorkspacePanel() {},
    addHeaderButton({ button, workspaceId }) {
      buttons.push({ button, workspaceId });
      return { remove() {} };
    },
    openPanel: (...args) => opened.push(args),
    paseo: {
      workspaces: {
        list: async () => ({
          entries: [{ id: "correct" }],
          subscription: {
            subscribe() {},
            release: async () => {
              released++;
            },
          },
        }),
      },
    },
  });
  await tick();
  assert.equal(buttons[0].workspaceId, "correct");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  let renderer;
  await act(async () => {
    renderer = create(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(buttons[0].button.icon, {
          workspaceId: "correct",
          layout: { compact: false },
          size: 16,
          color: "#fff",
        }),
      ),
    );
    await tick();
  });
  await act(tick);
  assert.deepEqual(requests, ["correct"]);
  assert.deepEqual(opened, [
    ["pull-request", { workspaceId: "correct", location: "explorer" }],
  ]);
  await act(async () => {
    await client.invalidateQueries();
    await tick();
  });
  assert.equal(opened.length, 1);
  await act(async () => renderer.unmount());
  stop();
  client.clear();
  assert.equal(released, 1);
});

test("panel renders the verified PR and diff for a child checkout and hides stale data on branch change", async () => {
  globalThis.branches = { chat: "main", task: "feat/task" };
  globalThis.inspectCheckout = async () => state("task", 231);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const element = () =>
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ChangesPanel, {
        workspaceId: "chat",
        theme,
        layout: { compact: false },
      }),
    );
  let renderer;
  await act(async () => {
    renderer = create(element());
    await tick();
  });
  await act(tick);
  assert.match(
    JSON.stringify(renderer.toJSON()),
    /github.com\/owner\/project\/pull\/231/,
  );
  assert.match(JSON.stringify(renderer.toJSON()), /correct diff/);
  assert.match(JSON.stringify(renderer.toJSON()), /registered task worktree/);
  globalThis.branches.task = "fix/new-task";
  await act(async () => renderer.update(element()));
  assert.doesNotMatch(
    JSON.stringify(renderer.toJSON()),
    /github.com\/owner\/project\/pull\/231/,
  );
  await act(async () => renderer.unmount());
  client.clear();
});
