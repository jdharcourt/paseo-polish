import type { PluginServerContext } from "@getpaseo/plugin/server";
import { readPullRequest } from "./shared/pull-request";
import { inspectPullRequest } from "./server/pull-request";
import { inspectCheckout } from "./shared/checkout";
import { inspectWorkspace } from "./server/checkout";

// Paseo requires a default export for runtime entrypoints.
export default function contribute(server: PluginServerContext) {
  server.handle(inspectCheckout, ({ workspaceId, refresh }, { paseo }) =>
    inspectWorkspace(workspaceId, paseo, refresh),
  );
  server.handle(readPullRequest, ({ workspaceId }, { paseo }) =>
    inspectPullRequest(workspaceId, paseo),
  );
  return server.addHook(
    "workspace.create.after",
    async ({ workspace }, { paseo }) => {
      const created = await paseo.workspaces.ref(workspace.id).refresh();
      if (!created?.parentWorkspaceId || created.workspaceKind !== "worktree")
        return;
      await paseo.workspaces
        .ref(created.parentWorkspaceId)
        .setMetadata({ "polish.checkoutWorkspaceId": created.id });
    },
  );
}
