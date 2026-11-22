import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const checkoutState = z.object({
  workspaceId: z.string(),
  directory: z.string(),
  branch: z.string(),
  head: z.string(),
  base: z.string(),
  diff: z.string(),
  localDiff: z.string(),
  files: z.array(z.string()),
  truncated: z.boolean(),
  error: z.string(),
  pullRequest: z
    .object({
      number: z.number(),
      title: z.string(),
      url: z.string().url(),
      state: z.string(),
      head: z.string(),
      base: z.string(),
    })
    .nullable(),
});

export type CheckoutState = z.infer<typeof checkoutState>;
export const inspectCheckout = defineRpc({
  name: "checkout.inspect",
  input: z.object({
    workspaceId: z.string().min(1).max(200),
    refresh: z.boolean().optional(),
  }),
  output: checkoutState,
});
