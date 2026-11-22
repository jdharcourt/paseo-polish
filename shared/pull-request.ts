import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const pullRequestDetails = z.object({
  url: z.string().url(),
  head: z.string(),
  repository: z.string(),
  reviewDecision: z.string(),
  checks: z.array(
    z.object({
      name: z.string(),
      workflow: z.string(),
      url: z.string(),
      state: z.enum(["success", "failure", "pending", "skipped"]),
      durationSeconds: z.number().nullable(),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string(),
      author: z.string(),
      body: z.string(),
      url: z.string(),
      time: z.string(),
      head: z.string(),
      kind: z.enum(["comment", "review"]),
      state: z.string(),
    }),
  ),
  limited: z.boolean(),
});
export type PullRequestDetails = z.infer<typeof pullRequestDetails>;
export const readPullRequest = defineRpc({
  name: "checkout.pull-request",
  input: z.object({ workspaceId: z.string().min(1).max(200) }),
  output: pullRequestDetails,
});
