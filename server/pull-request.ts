import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PaseoApi } from "@getpaseo/client";
import { z } from "zod";
import { inspectWorkspace } from "./checkout";
import type { PullRequestDetails } from "../shared/pull-request";

const exec = promisify(execFile);
const githubCheck = z.object({
      name: z.string().optional(),
      context: z.string().optional(),
      workflowName: z.string().optional(),
      detailsUrl: z.string().nullable().optional(),
      targetUrl: z.string().nullable().optional(),
      status: z.string().optional(),
      conclusion: z.string().nullable().optional(),
      state: z.string().optional(),
      startedAt: z.string().nullable().optional(),
      completedAt: z.string().nullable().optional(),
    }).extend({
  summary: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  steps: z.object({ nodes: z.array(z.object({ name: z.string(), conclusion: z.string().nullable() })) }).optional(),
  annotations: z.object({ nodes: z.array(z.object({ path: z.string(), message: z.string() })) }).optional(),
});
const rollup = z.object({ contexts: z.object({ nodes: z.array(githubCheck), totalCount: z.number() }) }).nullable();
const monitoring = z.object({ data: z.object({ repository: z.object({ pullRequest: z.object({
  headRefOid: z.string(),
  mergeQueueEntry: z.object({ position: z.number(), state: z.string(), headCommit: z.object({ oid: z.string(), statusCheckRollup: rollup }).nullable() }).nullable(),
  commits: z.object({ nodes: z.array(z.object({ commit: z.object({ statusCheckRollup: rollup }) })) }),
}) }) }) });
const checkFields = `contexts(first:100) { totalCount nodes { ... on CheckRun { name status conclusion detailsUrl startedAt completedAt summary text steps(first:100) { nodes { name conclusion } } annotations(first:10) { nodes { path message } } } ... on StatusContext { context state targetUrl description } } }`;
const githubDetails = z.object({
  url: z.string().url(),
  headRefOid: z.string(),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]).default("OPEN"),
  isDraft: z.boolean().default(false),
  reviewDecision: z.string().nullable(),
  statusCheckRollup: z.array(githubCheck),
  comments: z.array(
    z.object({
      id: z.string(),
      author: z.object({ login: z.string() }).nullable(),
      body: z.string(),
      createdAt: z.string(),
      url: z.string(),
    }),
  ),
  reviews: z.array(
    z.object({
      id: z.string(),
      author: z.object({ login: z.string() }).nullable(),
      body: z.string(),
      submittedAt: z.string().nullable(),
      state: z.string(),
      commit: z.object({ oid: z.string() }).nullable().optional(),
    }),
  ),
});

export async function inspectPullRequest(
  workspaceId: string,
  paseo: Pick<PaseoApi, "workspaces">,
): Promise<PullRequestDetails> {
  const checkout = await inspectWorkspace(workspaceId, paseo);
  const pr = checkout.pullRequest;
  if (!pr)
    throw new Error("No verified pull request is available for this checkout");
  const response = await exec(
    "gh",
    [
      "pr",
      "view",
      pr.url,
      "--json",
      "url,headRefOid,state,isDraft,statusCheckRollup,comments,reviews,reviewDecision",
    ],
    {
      cwd: checkout.directory,
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  const details = githubDetails.parse(JSON.parse(response.stdout));
  if (details.url.toLowerCase() !== pr.url.toLowerCase())
    throw new Error("GitHub returned a different pull request");
  let queue: PullRequestDetails["queue"] = null;
  let queueError = "";
  let queueChecks: z.infer<typeof githubCheck>[] = [];
  let prChecks = details.statusCheckRollup;
  let checksLimited = false;
  try {
    const [owner, repository] = pr.url.split("/").slice(3, 5);
    const response = await exec("gh", ["api", "graphql", "-f", `query=query($owner:String!,$repo:String!,$number:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$number){ headRefOid mergeQueueEntry { position state headCommit { oid statusCheckRollup { ${checkFields} } } } commits(last:1) { nodes { commit { statusCheckRollup { ${checkFields} } } } } } } }`, "-f", `owner=${owner}`, "-f", `repo=${repository}`, "-F", `number=${pr.number}`], { cwd: checkout.directory, encoding: "utf8", timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
    const live = monitoring.parse(JSON.parse(response.stdout)).data.repository.pullRequest;
    if (live.headRefOid !== details.headRefOid) throw new Error("PR head changed");
    const entry = live.mergeQueueEntry;
    queue = entry ? { position: entry.position, state: entry.state, head: entry.headCommit?.oid ?? null } : null;
    queueChecks = entry?.headCommit?.statusCheckRollup?.contexts.nodes ?? [];
    const current = live.commits.nodes[0]?.commit.statusCheckRollup;
    if (current) prChecks = current.contexts.nodes;
    checksLimited = (current?.contexts.totalCount ?? 0) > 100 || (entry?.headCommit?.statusCheckRollup?.contexts.totalCount ?? 0) > 100;
  } catch {
    queueError = "Merge queue status and detailed CI output unavailable; refresh or view GitHub.";
  }
  const checks = [...prChecks.slice(0, 500).map(check => ({ ...check, source: "pr" as const })), ...queueChecks.map(check => ({ ...check, source: "queue" as const }))]
    .map<PullRequestDetails["checks"][number]>((check) => {
      const status = (
        check.conclusion ||
        check.state ||
        check.status ||
        "PENDING"
      ).toUpperCase();
      const state =
        status === "SUCCESS"
          ? "success"
          : ["SKIPPED", "NEUTRAL"].includes(status)
            ? "skipped"
            : [
                  "FAILURE",
                  "ERROR",
                  "CANCELLED",
                  "TIMED_OUT",
                  "ACTION_REQUIRED",
                  "STALE",
                  "STARTUP_FAILURE",
                ].includes(status)
              ? "failure"
              : "pending";
      const duration =
        check.startedAt && check.completedAt
          ? (Date.parse(check.completedAt) - Date.parse(check.startedAt)) / 1000
          : NaN;
      const url = check.detailsUrl || check.targetUrl || "";
      return {
        source: check.source,
        reason: [`Result: ${check.conclusion || check.state || check.status || "PENDING"}`, ...(check.steps?.nodes.filter(step => step.conclusion && !["SUCCESS", "SKIPPED", "NEUTRAL"].includes(step.conclusion)).map(step => `${step.name}: ${step.conclusion}`) ?? []), check.summary, check.text, check.description, ...(check.annotations?.nodes.map(item => `${item.path}: ${item.message}`) ?? [])].filter(Boolean).join("\n\n").slice(0, 12000),
        name: check.name ?? check.context ?? "Check",
        workflow: check.workflowName ?? "",
        state,
        url: /^https:\/\//.test(url) ? url : "",
        durationSeconds: Number.isFinite(duration)
          ? Math.max(0, Math.round(duration))
          : null,
      };
    });
  const activity = [
    ...details.comments.map((comment) => ({
      id: comment.id,
      author: comment.author?.login ?? "Deleted user",
      body: comment.body.slice(0, 20000),
      url: comment.url,
      time: comment.createdAt,
      head: "",
      kind: "comment" as const,
      state: "",
    })),
    ...details.reviews
      .filter((review) => review.submittedAt)
      .map((review) => ({
        id: review.id,
        author: review.author?.login ?? "Deleted user",
        body: review.body.slice(0, 20000),
        url: pr.url,
        time: review.submittedAt!,
        head: review.commit?.oid ?? "",
        kind: "review" as const,
        state: review.state,
      })),
  ]
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    .slice(-100);
  return {
    url: pr.url,
    head: details.headRefOid,
    repository: pr.url.split("/").slice(3, 5).join("/"),
    reviewDecision: details.reviewDecision ?? "",
    state: details.state,
    isDraft: details.isDraft,
    queue,
    queueError,
    checks,
    activity,
    limited:
      checksLimited ||
      details.comments.length >= 100 ||
      details.reviews.length >= 100 ||
      details.statusCheckRollup.length > 500 ||
      details.comments.length + details.reviews.length > 100 ||
      [...details.comments, ...details.reviews].some(
        (item) => item.body.length > 20000,
      ),
  };
}
