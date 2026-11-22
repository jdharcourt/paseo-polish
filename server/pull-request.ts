import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PaseoApi } from "@getpaseo/client";
import { z } from "zod";
import { inspectWorkspace } from "./checkout";
import type { PullRequestDetails } from "../shared/pull-request";

const exec = promisify(execFile);
const githubDetails = z.object({
  url: z.string().url(),
  headRefOid: z.string(),
  reviewDecision: z.string().nullable(),
  statusCheckRollup: z.array(
    z.object({
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
    }),
  ),
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
      "url,headRefOid,statusCheckRollup,comments,reviews,reviewDecision",
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
  const checks = details.statusCheckRollup
    .slice(0, 500)
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
    checks,
    activity,
    limited:
      details.comments.length >= 100 ||
      details.reviews.length >= 100 ||
      details.statusCheckRollup.length > 500 ||
      details.comments.length + details.reviews.length > 100 ||
      [...details.comments, ...details.reviews].some(
        (item) => item.body.length > 20000,
      ),
  };
}
