import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, chmod, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

await build({ entryPoints: ["server/checkout.ts"], outfile: "test-results/checkout-integration.mjs", bundle: true, platform: "node", format: "esm" });
const { inspectWorkspace } = await import("../test-results/checkout-integration.mjs");
let directory;
let previousPath;
let head;
const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const workspace = (id = "task", extra = {}) => ({ id, projectId: "project", workspaceKind: "worktree", workspaceDirectory: directory, ...extra });
const inspect = (entries = [workspace()], id = "task") => inspectWorkspace(id, { workspaces: { list: async () => ({ entries }) } });
const patch = "diff --git a/tracked.txt b/tracked.txt\n--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1 @@\n-before\n+committed\n";
async function forge(overrides = {}) {
  await writeFile(join(directory, "fixture.json"), JSON.stringify({
    requests: [{ number: 42, title: "Task PR", url: "https://github.com/owner/project/pull/42", state: "OPEN", baseRefName: "main", headRefName: "feat/task", headRefOid: head, headRepository: { name: "project" }, headRepositoryOwner: { login: "owner" } }],
    diff: patch,
    ...overrides,
  }));
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
  await writeFile(join(directory, "bin", "gh"), `#!/usr/bin/env node\nconst fs=require('node:fs');const cp=require('node:child_process');const x=JSON.parse(fs.readFileSync('fixture.json','utf8'));if(x.fail)process.exit(1);if(x.switchBranch)cp.execFileSync('git',['switch','main']);if(process.argv.includes('list'))process.stdout.write(JSON.stringify(x.requests));else if(process.argv.includes('diff'))process.stdout.write(x.diff);else process.exit(2);\n`);
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
  const initial = JSON.parse(await (await import("node:fs/promises")).readFile(join(directory, "fixture.json"), "utf8"));
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
  await forge({ requests: [{ number: 99, title: "Wrong PR", url: "https://github.com/owner/project/pull/99", state: "OPEN", baseRefName: "main", headRefName: "feat/task", headRefOid: head, headRepository: { name: "project" }, headRepositoryOwner: { login: "another-owner" } }] });
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
  const result = await inspect([workspace("chat", { workspaceKind: "local_checkout", workspaceDirectory: "/not-the-task" }), workspace("task", { parentWorkspaceId: "chat" })], "chat");
  assert.equal(result.workspaceId, "task");
  assert.equal(result.directory, directory);
  assert.equal(result.pullRequest.number, 42);
});

test("multiple children are reported rather than guessing a task PR", async () => {
  const result = await inspect([workspace("chat", { workspaceKind: "local_checkout" }), workspace("task", { parentWorkspaceId: "chat" }), workspace("other", { parentWorkspaceId: "chat" })], "chat");
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
  const result = await inspect([workspace("chat", { metadata: { "polish.checkoutWorkspaceId": "task" } }), workspace("task", { parentWorkspaceId: "chat", projectId: "plugin-project" }), workspace("older", { parentWorkspaceId: "chat" })], "chat");
  assert.equal(result.workspaceId, "task");
  assert.equal(result.pullRequest.number, 42);
});

test("a task link cannot select an unrelated workspace", async () => {
  await assert.rejects(inspect([workspace("chat", { metadata: { "polish.checkoutWorkspaceId": "unrelated" } }), workspace("unrelated")], "chat"), /linked task worktree is unavailable/);
});
