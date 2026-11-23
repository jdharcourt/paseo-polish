import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, lstat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { PaseoApi } from "@getpaseo/client";
import { z } from "zod";
import type { CheckoutState } from "../shared/checkout";

const exec = promisify(execFile);
const pullRequests = z.array(
  z.object({
    number: z.number(),
    title: z.string(),
    url: z.string().url(),
    state: z.string(),
    baseRefName: z.string(),
    headRefName: z.string(),
    headRefOid: z.string(),
    headRepository: z.object({ name: z.string() }).nullable(),
    headRepositoryOwner: z.object({ login: z.string() }).nullable(),
  }),
);
const cache = new Map<
  string,
  {
    expires: number;
    request: CheckoutState["pullRequest"];
    diff: string;
    error: string;
    truncated: boolean;
  }
>();

export async function inspectWorkspace(
  workspaceId: string,
  paseo: Pick<PaseoApi, "workspaces">,
  refresh = false,
): Promise<CheckoutState> {
  const workspaces = await paseo.workspaces.list();
  let workspace = workspaces.entries.find((entry) => entry.id === workspaceId);
  if (!workspace) throw new Error("Workspace is no longer available");
  const linked = workspace.metadata?.["polish.checkoutWorkspaceId"];
  if (typeof linked === "string") {
    const target = workspaces.entries.find(
      (entry) => entry.id === linked && entry.parentWorkspaceId === workspaceId,
    );
    if (!target) throw new Error("The linked task worktree is unavailable");
    workspace = target;
  }
  const children = workspaces.entries.filter(
    (entry) =>
      entry.parentWorkspaceId === workspaceId &&
      entry.projectId === workspace!.projectId &&
      entry.workspaceKind === "worktree",
  );
  if (
    !linked &&
    workspace.workspaceKind === "local_checkout" &&
    children.length === 1
  )
    workspace = children[0];
  const directory =
    workspace.workspaceDirectory ??
    workspace.project?.checkout.cwd ??
    workspace.projectRootPath;
  const result: CheckoutState = {
    workspaceId: workspace.id,
    directory,
    branch: "",
    head: "",
    base: "HEAD",
    diff: "",
    localDiff: "",
    files: [],
    truncated: false,
    error: "",
    pullRequest: null,
  };
  if (
    !linked &&
    workspace.workspaceKind === "local_checkout" &&
    children.length > 1
  ) {
    result.error =
      "This chat has multiple registered task worktrees; open the intended task workspace";
    return result;
  }
  const git = async (args: string[]) =>
    (
      await exec("git", ["-c", "core.quotePath=false", ...args], {
        cwd: directory,
        encoding: "utf8",
        timeout: 10000,
        maxBuffer: 2 * 1024 * 1024,
      })
    ).stdout.trimEnd();
  try {
    result.head = await git(["rev-parse", "--verify", "HEAD"]);
    result.branch = await git(["branch", "--show-current"]);
  } catch {
    result.error = "This workspace has no Git commit to compare";
    return result;
  }
  let repository = "";
  try {
    if (!result.branch) throw new Error("Detached checkout");
    const remotes = (await git(["remote"])).split("\n");
    let remote = "origin";
    try {
      remote = await git(["config", "--get", `branch.${result.branch}.remote`]);
    } catch {}
    if (!remotes.includes(remote)) remote = remotes[0];
    const url = await git(["remote", "get-url", remote]);
    repository =
      /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(
        url,
      )?.[1] ?? "";
    if (!repository) throw new Error("unsupported remote");
    const key = `${directory}\0${result.branch}\0${result.head}\0${repository}`;
    let cached = cache.get(key);
    if (refresh || !cached || cached.expires < Date.now()) {
      cached = {
        expires: Date.now() + 10000,
        request: null,
        diff: "",
        error: "",
        truncated: false,
      };
      try {
        const response = await exec(
          "gh",
          [
            "pr",
            "list",
            "--state",
            "all",
            "--head",
            result.branch,
            "--limit",
            "30",
            "--json",
            "number,title,url,state,baseRefName,headRefName,headRefOid,headRepository,headRepositoryOwner",
          ],
          {
            cwd: directory,
            encoding: "utf8",
            timeout: 15000,
            maxBuffer: 1024 * 1024,
          },
        );
        const matches = pullRequests
          .parse(JSON.parse(response.stdout))
          .filter(
            (pr) =>
              pr.headRefName === result.branch &&
              `${pr.headRepositoryOwner?.login}/${pr.headRepository?.name}`.toLowerCase() ===
                repository.toLowerCase(),
          );
        const match =
          matches.find((pr) => pr.state === "OPEN") ??
          matches.find((pr) => pr.headRefOid === result.head);
        if (match) {
          if (
            !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(
              match.url,
            )
          )
            throw new Error("Invalid PR URL");
          cached.request = {
            number: match.number,
            title: match.title,
            url: match.url,
            state: match.state,
            head: match.headRefOid,
            base: match.baseRefName,
          };
          const diff = await exec(
            "gh",
            ["pr", "diff", match.url, "--color", "never"],
            {
              cwd: directory,
              encoding: "utf8",
              timeout: 15000,
              maxBuffer: 2 * 1024 * 1024,
            },
          );
          cached.diff = diff.stdout.slice(0, 200000);
          cached.truncated = diff.stdout.length > 200000;
        }
      } catch {
        cached.error =
          "GitHub PR lookup or diff failed; check gh authentication and connectivity";
      }
      if (cache.size > 100) cache.clear();
      cache.set(key, cached);
    }
    result.pullRequest = cached.request;
    result.error = cached.error;
    result.truncated = cached.truncated;
    if (cached.request && cached.request.head === result.head) {
      result.diff = cached.diff;
      result.base = `${cached.request.base} (PR #${cached.request.number})`;
    }
  } catch {
    result.error =
      "GitHub PR discovery requires a GitHub remote and authenticated gh CLI";
  }
  if (!result.pullRequest || result.pullRequest.head !== result.head) {
    const base = result.pullRequest?.base;
    const candidates = base
      ? [`refs/remotes/origin/${base}`, `refs/heads/${base}`]
      : [
          "refs/remotes/origin/HEAD",
          "refs/remotes/origin/main",
          "refs/heads/main",
          "refs/remotes/origin/master",
          "refs/heads/master",
        ];
    for (const ref of candidates) {
      try {
        const commit = await git(["merge-base", "HEAD", ref]);
        result.base = ref;
        result.diff = await git([
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          "--no-color",
          commit,
          "HEAD",
          "--",
        ]);
        break;
      } catch {}
    }
  }
  try {
    result.localDiff = await git([
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "HEAD",
      "--",
    ]);
    const untracked = (
      await git(["ls-files", "--others", "--exclude-standard", "-z"])
    )
      .split("\0")
      .filter(Boolean);
    for (const file of untracked.slice(0, 100)) {
      const path = resolve(directory, file);
      if (!path.startsWith(resolve(directory) + sep)) continue;
      const stat = await lstat(path);
      if (!stat.isFile()) continue;
      if (stat.size > 32768) {
        result.localDiff += `\nUntracked file: ${file} (preview exceeds 32 KB)\n`;
        continue;
      }
      const bytes = await readFile(path);
      result.localDiff += bytes.includes(0)
        ? `\nUntracked binary file: ${file}\n`
        : `\ndiff --git a/${file} b/${file}\n--- /dev/null\n+++ b/${file}\n${bytes
            .toString("utf8")
            .split("\n")
            .map((line) => `+${line}`)
            .join("\n")}\n`;
    }
    result.files = [
      ...new Set(
        [
          ...result.diff.matchAll(/^diff --git a\/(.*) b\/(.*)$/gm),
          ...result.localDiff.matchAll(/^diff --git a\/(.*) b\/(.*)$/gm),
        ]
          .map((match) => match[2])
          .concat(untracked),
      ),
    ].slice(0, 500);
    result.truncated ||=
      untracked.length > 100 ||
      result.diff.length > 200000 ||
      result.localDiff.length > 200000;
    result.diff = result.diff.slice(0, 200000);
    result.localDiff = result.localDiff.slice(0, 200000);
    if (
      (await git(["rev-parse", "--verify", "HEAD"])) !== result.head ||
      (await git(["branch", "--show-current"])) !== result.branch
    ) {
      result.pullRequest = null;
      result.diff = "";
      result.localDiff = "";
      result.files = [];
      result.error = "Checkout changed during refresh; refreshing again";
    }
  } catch {
    result.error = "Git diff could not be read completely; refresh to retry";
  }
  return result;
}
