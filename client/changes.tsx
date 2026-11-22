import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  useRpc,
  useWorkspace,
  openExternalUrl,
  type PluginClientContext,
  type PluginWorkspacePanelProps,
  type PluginButtonIconProps,
} from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { PullRequestView } from "./pull-request";
import { inspectCheckout } from "../shared/checkout";

function useCheckout(workspaceId: string) {
  const inspect = useRpc(inspectCheckout);
  const branch = useWorkspace(workspaceId, (workspace) => workspace.branch);
  return useQuery({
    queryKey: ["polish-checkout", workspaceId, branch],
    queryFn: () => inspect({ workspaceId }),
    refetchInterval: 3000,
    staleTime: 2000,
    retry: 1,
  });
}

export function ChangesPanel({
  workspaceId,
  theme,
  layout,
}: PluginWorkspacePanelProps) {
  const query = useCheckout(workspaceId);
  const branch = useWorkspace(
    query.data?.workspaceId ?? workspaceId,
    (workspace) => workspace.branch,
  );
  const data =
    !query.isError && query.data && (!branch || query.data.branch === branch)
      ? query.data
      : undefined;
  const text = { color: theme.colors.foreground, fontSize: 14 };
  const muted = { color: theme.colors.foregroundMuted, fontSize: 13 };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      contentContainerStyle={{ padding: layout.compact ? 12 : 16, gap: 12 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ ...text, fontWeight: "600" }}>Changes &amp; PR</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void query.refetch()}
        >
          <Text style={text}>Refresh</Text>
        </Pressable>
      </View>
      {query.isPending || (!data && !query.isError) ? (
        <Text style={muted}>Reading workspace checkout…</Text>
      ) : null}
      {query.isError ? (
        <Text style={text}>Checkout inspection failed; refresh to retry</Text>
      ) : null}
      {data ? (
        <>
          <Text selectable style={muted}>
            {data.directory}
          </Text>
          <Text selectable style={text}>
            {data.branch || "Detached HEAD"} · {data.head.slice(0, 12)}
          </Text>
          {data.workspaceId !== workspaceId ? (
            <Text style={muted}>
              Showing this chat’s registered task worktree
            </Text>
          ) : null}
          {data.error ? <Text style={text}>{data.error}</Text> : null}
          {data.pullRequest ? (
            <View
              style={{
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
                paddingBottom: 12,
              }}
            >
              <Pressable
                accessibilityRole="link"
                onPress={() => void openExternalUrl(data.pullRequest!.url)}
              >
                <Text style={{ ...text, fontWeight: "600" }}>
                  #{data.pullRequest.number} {data.pullRequest.title}
                </Text>
              </Pressable>
              <Text style={muted}>
                {data.pullRequest.state} · base {data.pullRequest.base}
              </Text>
              <Text selectable style={muted}>
                {data.pullRequest.url}
              </Text>
              {data.pullRequest.head !== data.head ? (
                <Text style={text}>
                  Local HEAD differs from the PR head ·{" "}
                  {data.pullRequest.head.slice(0, 12)}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={muted}>
              No verified PR found for this checkout branch
            </Text>
          )}
          <Text style={muted}>
            Comparison: {data.base} · {data.files.length} changed files
          </Text>
          {data.files.map((file) => (
            <Text key={file} selectable style={text}>
              {file}
            </Text>
          ))}
          {data.truncated ? (
            <Text style={text}>
              Preview is limited; some files or diff content are omitted
            </Text>
          ) : null}
          {data.diff ? (
            <>
              <Text style={{ ...text, fontWeight: "600" }}>
                {data.pullRequest?.head === data.head
                  ? "Pull request changes"
                  : "Committed changes"}
              </Text>
              <Text
                selectable
                style={{ ...text, fontSize: 12, fontFamily: "monospace" }}
              >
                {data.diff}
              </Text>
            </>
          ) : null}
          {data.localDiff ? (
            <>
              <Text style={{ ...text, fontWeight: "600" }}>
                Local changes, including untracked files
              </Text>
              <Text
                selectable
                style={{ ...text, fontSize: 12, fontFamily: "monospace" }}
              >
                {data.localDiff}
              </Text>
            </>
          ) : null}
          {!data.diff &&
          !data.localDiff &&
          !data.files.length &&
          !data.error ? (
            <Text style={muted}>No changes in this checkout</Text>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

export function PullRequestPanel({
  workspaceId,
  theme,
  layout,
}: PluginWorkspacePanelProps) {
  const query = useCheckout(workspaceId);
  const inspect = useRpc(inspectCheckout);
  const branch = useWorkspace(
    query.data?.workspaceId ?? workspaceId,
    (workspace) => workspace.branch,
  );
  const data =
    !query.isError && query.data && (!branch || query.data.branch === branch)
      ? query.data
      : undefined;
  const refresh = async () => {
    await inspect({ workspaceId, refresh: true });
    await query.refetch();
  };
  if (data?.pullRequest)
    return (
      <PullRequestView
        key={data.pullRequest.url}
        workspaceId={workspaceId}
        theme={theme}
        pr={data.pullRequest}
        onRefresh={refresh}
      />
    );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      contentContainerStyle={{ padding: layout.compact ? 12 : 16, gap: 12 }}
    >
      <Text style={{ color: theme.colors.foreground, fontSize: 16 }}>
        Pull request
      </Text>
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14 }}>
        {query.isError
          ? "Checkout lookup failed; refresh to retry"
          : data?.error ||
            (data
              ? "No verified pull request found for this branch"
              : "Looking up this workspace’s pull request…")}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void refresh().catch(() => {});
        }}
      >
        <Text style={{ color: theme.colors.foreground }}>Refresh</Text>
      </Pressable>
    </ScrollView>
  );
}

export function registerChanges(client: PluginClientContext) {
  const opened = new Set<string>();
  const buttons = new Map<
    string,
    ReturnType<PluginClientContext["addHeaderButton"]>
  >();
  const lifetime = new AbortController();
  let stopObservation: (() => void) | undefined;
  function ChangesIcon({
    workspaceId,
    layout,
    size,
    color,
  }: PluginButtonIconProps) {
    const query = useCheckout(workspaceId);
    const branch = useWorkspace(
      query.data?.workspaceId ?? workspaceId,
      (workspace) => workspace.branch,
    );
    useEffect(() => {
      const data = query.data;
      if (
        layout.compact ||
        query.isError ||
        !data ||
        (branch && branch !== data.branch) ||
        (!data.files.length && !data.pullRequest && !data.error)
      )
        return;
      const key = `${workspaceId}:${data.workspaceId}:${data.branch}:${data.pullRequest?.url ?? ""}`;
      if (opened.has(key)) return;
      opened.add(key);
      client.openPanel(data.pullRequest ? "pull-request" : "checkout", {
        workspaceId,
        location: "explorer",
      });
    }, [workspaceId, layout.compact, query.data, query.isError, branch]);
    return <Icon name="GitPullRequest" size={size} color={color} />;
  }
  const update = (entries: { id: string }[]) => {
    if (lifetime.signal.aborted) return;
    const present = new Set(entries.map((entry) => entry.id));
    for (const [id, button] of buttons) {
      if (present.has(id)) continue;
      button.remove();
      buttons.delete(id);
    }
    for (const { id } of entries) {
      if (buttons.has(id)) continue;
      buttons.set(
        id,
        client.addHeaderButton({
          id: "checkout",
          workspaceId: id,
          button: {
            title: "Pull request",
            icon: ChangesIcon,
            behavior: {
              kind: "action",
              onPress() {
                client.openPanel("pull-request", {
                  workspaceId: id,
                  location: "explorer",
                });
              },
            },
          },
        }),
      );
    }
  };
  client.addWorkspacePanel({
    id: "pull-request",
    title: "Pull request",
    icon: "GitPullRequest",
    locations: ["explorer"],
    Component: PullRequestPanel,
  });
  client.addWorkspacePanel({
    id: "checkout",
    title: "Changes",
    icon: "GitPullRequest",
    locations: ["explorer"],
    Component: ChangesPanel,
  });
  void client.paseo.workspaces
    .list({ subscribe: {} })
    .then(({ entries, subscription }) => {
      if (lifetime.signal.aborted) {
        void subscription.release();
        return;
      }
      stopObservation = () => {
        void subscription.release();
      };
      update(entries);
      subscription.subscribe({
        snapshot: ({ entries }) => update(entries),
        update: () => {
          void client.paseo.workspaces
            .list()
            .then(({ entries }) => update(entries))
            .catch(() => {});
        },
      });
    })
    .catch(() => {});
  return () => {
    lifetime.abort();
    stopObservation?.();
    for (const button of buttons.values()) button.remove();
    buttons.clear();
  };
}
