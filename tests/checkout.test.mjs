import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  mkdir,
  chmod,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

await build({
  stdin: {
    contents:
      'export { inspectWorkspace } from "./server/checkout"; export { inspectPullRequest } from "./server/pull-request";',
    resolveDir: process.cwd(),
  },
  outfile: "test-results/checkout-integration.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const { inspectWorkspace, inspectPullRequest } = await import(
  "../test-results/checkout-integration.mjs"
);
let directory;
let previousPath;
let head;
const git = (...args) =>
  execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const workspace = (id = "task", extra = {}) => ({
  id,
  projectId: "project",
  workspaceKind: "worktree",
  workspaceDirectory: directory,
  ...extra,
});
const inspect = (entries = [workspace()], id = "task") =>
  inspectWorkspace(id, { workspaces: { list: async () => ({ entries }) } });
const patch =
  "diff --git a/tracked.txt b/tracked.txt\n--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1 @@\n-before\n+committed\n";
async function forge(overrides = {}) {
  await writeFile(
    join(directory, "fixture.json"),
    JSON.stringify({
      requests: [
        {
          number: 42,
          title: "Task PR",
          url: "https://github.com/owner/project/pull/42",
          state: "OPEN",
          baseRefName: "main",
          headRefName: "feat/task",
          headRefOid: head,
          headRepository: { name: "project" },
          headRepositoryOwner: { login: "owner" },
        },
      ],
      diff: patch,
      details: {
        url: "https://github.com/owner/project/pull/42",
        headRefOid: head,
        reviewDecision: "APPROVED",
        statusCheckRollup: [],
        comments: [],
        reviews: [],
      },
      ...overrides,
    }),
  );
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "polish-checkout-"));
  git("init", "--initial-branch=main");
  git("config", "user.name", "Integration Test");
  git("config", "user.email", "test@example.invalid");
  await writeFile(join(directory, ".gitignore"), "bin/\nfixture.json\n");
  await writeFile(join(directory, "tracked.txt"), "before\n");
  git("add", ".");
  git("commit", "-m", "initial");
  git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
  git("switch", "-c", "feat/task");
  await writeFile(join(directory, "tracked.txt"), "committed\n");
  git("commit", "-am", "task");
  head = git("rev-parse", "HEAD");
  git("remote", "add", "origin", "https://github.com/owner/project.git");
  await mkdir(join(directory, "bin"));
  await writeFile(
    join(directory, "bin", "gh"),
    `#!/usr/bin/env node\nconst fs=require('node:fs');const cp=require('node:child_process');const x=JSON.parse(fs.readFileSync('fixture.json','utf8'));if(x.fail)process.exit(1);if(x.switchBranch)cp.execFileSync('git',['switch','main']);if(process.argv.includes('list'))process.stdout.write(JSON.stringify(x.requests));else if(process.argv.includes('diff'))process.stdout.write(x.diff);else if(process.argv.includes('view'))process.stdout.write(JSON.stringify(x.details));else if(process.argv.includes('graphql')){if(x.monitoring)process.stdout.write(JSON.stringify(x.monitoring));else process.exit(2);}else process.exit(2);\n`,
  );
  await chmod(join(directory, "bin", "gh"), 0o755);
  previousPath = process.env.PATH;
  process.env.PATH = join(directory, "bin") + ":" + previousPath;
  await forge();
});
afterEach(async () => {
  process.env.PATH = previousPath;
  await rm(directory, { recursive: true, force: true });
});

test("verifies branch, head repository, accepted SHA, and historical merged PR diff", async () => {
  git("update-ref", "refs/remotes/origin/main", head);
  const initial = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(join(directory, "fixture.json"), "utf8"),
  );
  initial.requests[0].state = "MERGED";
  await forge(initial);
  const result = await inspect();
  assert.equal(result.pullRequest.number, 42);
  assert.equal(result.pullRequest.state, "MERGED");
  assert.equal(result.pullRequest.head, head);
  assert.equal(result.diff, patch);
  assert.deepEqual(result.files, ["tracked.txt"]);
  assert.equal(result.error, "");
});

test("rejects a different fork with the same branch name and reads committed changes from base", async () => {
  await forge({
    requests: [
      {
        number: 99,
        title: "Wrong PR",
        url: "https://github.com/owner/project/pull/99",
        state: "OPEN",
        baseRefName: "main",
        headRefName: "feat/task",
        headRefOid: head,
        headRepository: { name: "project" },
        headRepositoryOwner: { login: "another-owner" },
      },
    ],
  });
  const result = await inspect();
  assert.equal(result.pullRequest, null);
  assert.match(result.diff, /\+committed/);
  assert.equal(result.base, "refs/remotes/origin/main");
});

test("includes staged, unstaged, and untracked changes without following symlinks", async () => {
  await writeFile(join(directory, "tracked.txt"), "staged\n");
  git("add", "tracked.txt");
  await writeFile(join(directory, "tracked.txt"), "unstaged\n");
  await writeFile(join(directory, "new file.txt"), "untracked content\n");
  await symlink("/etc/hosts", join(directory, "external-link"));
  const result = await inspect();
  assert.match(result.localDiff, /\+unstaged/);
  assert.match(result.localDiff, /\+untracked content/);
  assert.ok(result.files.includes("new file.txt"));
  assert.doesNotMatch(result.localDiff, /localhost/);
});

test("a parent's sole registered task worktree supplies its PR and checkout", async () => {
  const result = await inspect(
    [
      workspace("chat", {
        workspaceKind: "local_checkout",
        workspaceDirectory: "/not-the-task",
      }),
      workspace("task", { parentWorkspaceId: "chat" }),
    ],
    "chat",
  );
  assert.equal(result.workspaceId, "task");
  assert.equal(result.directory, directory);
  assert.equal(result.pullRequest.number, 42);
});

test("multiple children are reported rather than guessing a task PR", async () => {
  const result = await inspect(
    [
      workspace("chat", { workspaceKind: "local_checkout" }),
      workspace("task", { parentWorkspaceId: "chat" }),
      workspace("other", { parentWorkspaceId: "chat" }),
    ],
    "chat",
  );
  assert.equal(result.pullRequest, null);
  assert.match(result.error, /multiple registered task worktrees/);
});

test("GitHub failure leaves an explicit error and preserves the local diff", async () => {
  await forge({ fail: true });
  await writeFile(join(directory, "new.txt"), "new content\n");
  const result = await inspect();
  assert.equal(result.pullRequest, null);
  assert.match(result.error, /GitHub PR lookup or diff failed/);
  assert.match(result.localDiff, /new content/);
  assert.match(result.diff, /committed/);
});

test("a branch change during lookup discards the previous PR and diff", async () => {
  await forge({ switchBranch: true });
  const result = await inspect();
  assert.equal(result.pullRequest, null);
  assert.equal(result.diff, "");
  assert.match(result.error, /Checkout changed during refresh/);
});

test("oversized previews are explicitly marked", async () => {
  await forge({ diff: patch + "a".repeat(210000) });
  const result = await inspect();
  assert.equal(result.diff.length, 200000);
  assert.equal(result.truncated, true);
});

test("an explicit plugin-owned task link follows a registered child across projects", async () => {
  const result = await inspect(
    [
      workspace("chat", { metadata: { "polish.checkoutWorkspaceId": "task" } }),
      workspace("task", {
        parentWorkspaceId: "chat",
        projectId: "plugin-project",
      }),
      workspace("older", { parentWorkspaceId: "chat" }),
    ],
    "chat",
  );
  assert.equal(result.workspaceId, "task");
  assert.equal(result.pullRequest.number, 42);
});

test("a task link cannot select an unrelated workspace", async () => {
  await assert.rejects(
    inspect(
      [
        workspace("chat", {
          metadata: { "polish.checkoutWorkspaceId": "unrelated" },
        }),
        workspace("unrelated"),
      ],
      "chat",
    ),
    /linked task worktree is unavailable/,
  );
});

test("PR details include check states, workflow durations, comments, and revision-bound reviews", async () => {
  await forge({
    details: {
      url: "https://github.com/owner/project/pull/42",
      headRefOid: head,
      reviewDecision: "APPROVED",
      statusCheckRollup: [
        {
          name: "Integration",
          workflowName: "CI",
          conclusion: "SUCCESS",
          startedAt: "2026-11-22T10:00:00Z",
          completedAt: "2026-11-22T10:01:27Z",
          detailsUrl: "https://github.com/owner/project/actions/runs/1",
        },
        { name: "Security", status: "IN_PROGRESS", conclusion: null },
        {
          context: "External",
          state: "FAILURE",
          targetUrl: "javascript:alert(1)",
        },
        { name: "Optional", conclusion: "SKIPPED" },
      ],
      comments: [
        {
          id: "comment-1",
          author: { login: "reviewer" },
          body: "Please check this",
          createdAt: "2026-11-22T10:00:00Z",
          url: "https://github.com/owner/project/pull/42#issuecomment-1",
        },
      ],
      reviews: [
        {
          id: "review-1",
          author: { login: "approver" },
          body: "Looks correct",
          submittedAt: "2026-11-22T10:02:00Z",
          state: "APPROVED",
          commit: { oid: head },
        },
      ],
    },
  });
  const result = await inspectPullRequest("task", {
    workspaces: { list: async () => ({ entries: [workspace()] }) },
  });
  assert.deepEqual(
    result.checks.map((check) => check.state),
    ["success", "pending", "failure", "skipped"],
  );
  assert.equal(result.checks[0].durationSeconds, 87);
  assert.equal(result.checks[0].workflow, "CI");
  assert.equal(result.checks[2].url, "");
  assert.equal(result.activity[0].author, "reviewer");
  assert.equal(result.activity[1].head, head);
  assert.equal(result.limited, false);
});

test("PR detail lookup rejects an unrelated URL", async () => {
  await forge({
    details: {
      url: "https://github.com/another/project/pull/42",
      headRefOid: head,
      reviewDecision: "",
      statusCheckRollup: [],
      comments: [],
      reviews: [],
    },
  });
  await assert.rejects(
    inspectPullRequest("task", {
      workspaces: { list: async () => ({ entries: [workspace()] }) },
    }),
    /different pull request/,
  );
});

test("manual refresh bypasses the discovery cache when a PR opens", async () => {
  await forge({ requests: [] });
  assert.equal((await inspect()).pullRequest, null);
  await forge();
  const result = await inspectWorkspace(
    "task",
    { workspaces: { list: async () => ({ entries: [workspace()] }) } },
    true,
  );
  assert.equal(result.pullRequest.number, 42);
});

test("queue CI uses the queue commit and retains PR check diagnostics separately", async () => {
  await forge({
    details: { url: "https://github.com/owner/project/pull/42", headRefOid: head, state: "OPEN", isDraft: false, reviewDecision: "", statusCheckRollup: [], comments: [], reviews: [] },
    monitoring: { data: { repository: { pullRequest: {
      headRefOid: head,
      commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { totalCount: 1, nodes: [{ name: "PR tests", conclusion: "SUCCESS" }] } } } }] },
      mergeQueueEntry: { position: 2, state: "AWAITING_CHECKS", headCommit: { oid: "queue-sha", statusCheckRollup: { contexts: { totalCount: 1, nodes: [{ name: "Queue tests", conclusion: "FAILURE", summary: "Integration failed", steps: { nodes: [{ name: "Run tests", conclusion: "FAILURE" }] }, annotations: { nodes: [{ path: "test.ts", message: "Expected 2, got 1" }] } }] } } } },
    } } } },
  });
  const result = await inspectPullRequest("task", { workspaces: { list: async () => ({ entries: [workspace()] }) } });
  assert.deepEqual(result.queue, { position: 2, state: "AWAITING_CHECKS", head: "queue-sha" });
  assert.equal(result.state, "OPEN");
  assert.equal(result.queueError, "");
  assert.deepEqual(result.checks.map(check => [check.source, check.state]), [["pr", "success"], ["queue", "failure"]]);
  assert.match(result.checks[1].reason, /Run tests: FAILURE/);
  assert.match(result.checks[1].reason, /test.ts: Expected 2, got 1/);
});

test("queue API failure is explicit while PR checks remain available", async () => {
  const result = await inspectPullRequest("task", { workspaces: { list: async () => ({ entries: [workspace()] }) } });
  assert.match(result.queueError, /unavailable/);
  assert.equal(result.queue, null);
});

test("a queued PR without a generated commit has no queue checks", async () => {
  await forge({ monitoring: { data: { repository: { pullRequest: { headRefOid: head, commits: { nodes: [] }, mergeQueueEntry: { position: 1, state: "QUEUED", headCommit: null } } } } } });
  const result = await inspectPullRequest("task", { workspaces: { list: async () => ({ entries: [workspace()] }) } });
  assert.equal(result.queue.head, null);
  assert.equal(result.checks.filter(check => check.source === "queue").length, 0);
});
