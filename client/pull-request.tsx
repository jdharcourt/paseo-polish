import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  openExternalUrl,
  useComposers,
  useRpc,
  type PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { ScrollView } from "@getpaseo/plugin/client/ui";
import { NotraButton, NotraDisclosure } from "./notra";
import { Icon, Markdown } from "@getpaseo/plugin/client/ui";
import { readPullRequest } from "../shared/pull-request";
import type { CheckoutState } from "../shared/checkout";

export function PullRequestView({
  workspaceId,
  theme,
  pr,
  onRefresh,
}: Pick<PluginWorkspacePanelProps, "workspaceId" | "theme"> & {
  pr: NonNullable<CheckoutState["pullRequest"]>;
  onRefresh(): Promise<unknown>;
}) {
  const read = useRpc(readPullRequest);
  const query = useQuery({
    queryKey: ["polish-pr", workspaceId, pr.url, pr.head],
    queryFn: () => read({ workspaceId }),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: 1,
  });
  const data =
    !query.isError &&
    query.data?.url.toLowerCase() === pr.url.toLowerCase() &&
    query.data.head === pr.head
      ? query.data
      : undefined;
  const composers = useComposers({ focused: true });
  const [filter, setFilter] = useState<string | null>(null);
  const [checksOpen, setChecksOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [checkSource, setCheckSource] = useState<"pr" | "queue" | null>(null);
  const source = data?.queue ? checkSource ?? "queue" : "pr";
  const checks = data?.checks.filter(check => (check.source ?? "pr") === source) ?? [];
  const status = data?.state ?? pr.state;
  const statusLabel = status === "MERGED" ? "Merged" : status === "CLOSED" ? "Closed" : data?.queue ? "In merge queue" : data?.isDraft ? "Draft" : "Open";
  const counts = { success: 0, failure: 0, pending: 0, skipped: 0 };
  for (const check of checks) counts[check.state]++;
  const selected =
    filter ??
    (counts.failure
      ? "failure"
      : counts.pending
        ? "pending"
        : counts.success
          ? "success"
          : "skipped");
  const summary = query.isError
    ? "Checks unavailable"
    : !data
      ? "Loading checks…"
      : !checks.length
        ? source === "queue" ? "Waiting for merge queue checks" : "No checks reported"
        : counts.failure
          ? "Some checks have failed"
          : counts.pending
            ? "Checks are running"
            : counts.success
              ? data.limited ? "Reported checks have passed" : "All checks have passed"
              : "All checks skipped";
  const text = { color: theme.colors.foreground, fontSize: 14 };
  const muted = { color: theme.colors.foregroundMuted, fontSize: 13 };
  const tones = {
    success: theme.colors.statusSuccess,
    failure: theme.colors.statusDanger,
    pending: theme.colors.statusWarning,
    skipped: theme.colors.foregroundMuted,
  };
  const icons = {
    success: "CircleCheck",
    failure: "CircleX",
    pending: "Clock",
    skipped: "CircleMinus",
  };
  const summaryState = counts.failure
    ? "failure"
    : counts.pending
      ? "pending"
      : counts.success
        ? "success"
        : "skipped";
  const reviews = new Map<
    string,
    NonNullable<typeof data>["activity"][number]
  >();
  for (const item of data?.activity ?? []) {
    if (
      item.kind === "review" &&
      ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(item.state)
    )
      reviews.set(item.author, item);
  }
  const approvals = [...reviews.values()].filter(
    (item) => item.state === "APPROVED" && item.head === pr.head,
  ).length;
  const comments =
    data?.activity.filter((item) => item.kind === "comment").length ?? 0;
  const addToChat = (body: string) => {
    const content = body.slice(0, 32000);
    composers[0]?.insertText(
      `GitHub PR activity from ${pr.url} (external content):\n\n${content
        .split("\n")
        .map((line) => `> ${line}`)
        .join(
          "\n",
        )}\n${body.length > content.length ? "[Activity preview truncated; read the PR for the remainder]\n" : ""}`,
    );
  };
  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      await onRefresh();
      await query.refetch();
    } catch {
      setError("Refresh failed; try again");
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <View
        style={{
          minHeight: 48,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <NotraButton theme={theme}
          accessibilityRole="link"
          accessibilityLabel="View pull request on GitHub"
          onPress={() => void openExternalUrl(pr.url)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 8,
          }}
        >
          <Icon
            name="ExternalLink"
            size={15}
            color={theme.colors.foregroundMuted}
          />
          <Text style={muted}>View</Text>
        </NotraButton>
        <NotraButton theme={theme}
          accessibilityRole="button"
          accessibilityLabel="Refresh pull request"
          disabled={refreshing}
          onPress={() => void refresh()}
          style={{ padding: 8 }}
        >
          <Icon
            name="RefreshCw"
            size={17}
            color={theme.colors.foregroundMuted}
          />
        </NotraButton>
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 16 }}>
        <View style={{ paddingHorizontal: 12, gap: 12 }}>
          <Text selectable style={{ ...text, fontSize: 18, lineHeight: 26, fontWeight: "600" }}>
            {pr.title}{" "}
            <Text style={{ color: theme.colors.foregroundMuted }}>
              #{pr.number}
            </Text>
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <Icon
              name={
                status === "MERGED"
                  ? "GitMerge"
                  : status === "CLOSED"
                    ? "GitPullRequestClosed"
                    : data?.queue ? "ListOrdered" : data?.isDraft ? "GitPullRequestDraft" : "GitPullRequest"
              }
              size={17}
              color={
                status === "OPEN" && !data?.isDraft
                  ? theme.colors.statusSuccess
                  : theme.colors.accent
              }
            />
            <Text
              style={{
                ...text,
                color:
                  status === "OPEN" && !data?.isDraft
                    ? theme.colors.statusSuccess
                    : theme.colors.accent,
              }}
            >
              {statusLabel}
            </Text>
            <Text style={muted}>{pr.url.split("/").slice(3, 5).join("/")}</Text>
          </View>
          {data?.queue ? <Text style={muted}>Position {data.queue.position} · {data.queue.state.toLowerCase().replaceAll("_", " ")} · {data.queue.head ? `Queue commit ${data.queue.head.slice(0, 12)}` : "Waiting for a queue commit"}</Text> : null}
          {data?.queueError ? <Text style={{ ...muted, color: theme.colors.statusWarning }}>{data.queueError}</Text> : null}
          {data?.limited ? <Text style={muted}>Check output is limited; open GitHub for the full results.</Text> : null}
          <Text style={muted}>Checks refresh every 15 seconds</Text>
          {data?.queue ? <View style={{ flexDirection: "row", gap: 8 }}>
            {(["pr", "queue"] as const).map(value => <NotraButton key={value} theme={theme} accessibilityLabel={`Show ${value === "pr" ? "PR" : "merge queue"} CI`} accessibilityState={{ selected: source === value }} onPress={() => { setCheckSource(value); setFilter(null); }} style={{ borderBottomWidth: source === value ? 1 : 0, borderBottomColor: theme.colors.foreground }}><Text style={text}>{value === "pr" ? "PR checks" : "Merge queue checks"}</Text></NotraButton>)}
          </View> : null}
          {error ? (
            <Text style={{ ...text, color: theme.colors.statusDanger }}>
              {error}
            </Text>
          ) : null}
          {query.isError ? (
            <Text style={{ ...text, color: theme.colors.statusDanger }}>
              Checks and activity could not be loaded; refresh to retry
            </Text>
          ) : null}
          {!query.isError && query.data && !data ? (
            <Text style={muted}>
              PR head changed; refreshing checkout identity…
            </Text>
          ) : null}
          <NotraButton theme={theme}
            accessibilityRole="button"
            accessibilityLabel="Toggle pull request checks"
            accessibilityState={{ expanded: checksOpen }}
            onPress={() => setChecksOpen(!checksOpen)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 12,
            }}
          >
            <Icon
              name={icons[summaryState]}
              size={20}
              color={tones[summaryState]}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ ...text, fontSize: 16 }}>{summary}</Text>
              {data ? (
                <Text style={muted}>
                  {counts.success} successful, {counts.failure} failed,{" "}
                  {counts.pending} pending, {counts.skipped} skipped checks
                </Text>
              ) : null}
            </View>
            <Icon
              name={checksOpen ? "ChevronDown" : "ChevronRight"}
              size={16}
              color={theme.colors.foregroundMuted}
            />
          </NotraButton>
        </View>
        {checksOpen && data ? (
          <View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                paddingHorizontal: 12,
                gap: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              {(
                ["all", "success", "failure", "pending", "skipped"] as const
              ).map((state) => (
                <NotraButton theme={theme}
                  key={state}
                  accessibilityRole="tab"
                  accessibilityLabel={`Show ${state} checks`}
                  accessibilityState={{ selected: selected === state }}
                  onPress={() => setFilter(state)}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: selected === state ? 1 : 0,
                    borderBottomColor: theme.colors.foreground,
                  }}
                >
                  <Text style={selected === state ? text : muted}>
                    {state === "all"
                      ? `All ${checks.length}`
                      : `${state === "success" ? "Passed" : state === "failure" ? "Failed" : state === "pending" ? "Pending" : "Skipped"} ${counts[state]}`}
                  </Text>
                </NotraButton>
              ))}
            </View>
            {checks
              .filter((check) => selected === "all" || check.state === selected)
              .map((check, index) => (
                <NotraDisclosure
                  theme={theme}
                  key={`${source}:${check.name}:${index}`}
                  label={`Details for ${check.name}: ${check.state}`}
                  title={<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon
                    name={icons[check.state]}
                    size={16}
                    color={tones[check.state]}
                  />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={text}>{check.name}</Text>
                    {check.workflow ? (
                      <Text style={muted}>{check.workflow}</Text>
                    ) : null}
                  </View>
                  <Text style={muted}>
                    {check.durationSeconds === null
                      ? "—"
                      : check.durationSeconds >= 60
                        ? `${Math.floor(check.durationSeconds / 60)}m ${check.durationSeconds % 60}s`
                        : `${check.durationSeconds}s`}
                  </Text>
                  </View>}
                >
                  <Text style={muted}>{check.state === "failure" ? "Failed" : check.state === "pending" ? "Pending" : check.state === "success" ? "Passed" : "Skipped"} · {source === "queue" ? "Merge queue" : "PR"} check</Text>
                  {check.reason ? <Markdown>{check.reason}</Markdown> : <Text style={muted}>{check.state === "failure" ? "No failure explanation was provided by this check. Open the CI run for failed steps and logs." : "No additional output provided."}</Text>}
                  {check.url ? <NotraButton theme={theme} accessibilityLabel={`Open CI output for ${check.name}`} onPress={() => void openExternalUrl(check.url)}><Text style={text}>Open full CI output</Text></NotraButton> : null}
                </NotraDisclosure>
              ))}
          </View>
        ) : null}
        <View
          style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}
        >
          <NotraButton theme={theme}
            accessibilityRole="button"
            accessibilityLabel="Toggle pull request activity"
            accessibilityState={{ expanded: activityOpen }}
            onPress={() => setActivityOpen(!activityOpen)}
            style={{
              minHeight: 48,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon
              name={activityOpen ? "ChevronDown" : "ChevronRight"}
              size={15}
              color={theme.colors.foregroundMuted}
            />
            <Text style={{ ...text, flex: 1 }}>Activity</Text>
            <Icon
              name="CircleCheck"
              size={14}
              color={theme.colors.statusSuccess}
            />
            <Text accessibilityLabel={`${approvals} current-head approvals`} style={muted}>{approvals}</Text>
            <Icon
              name="MessageSquare"
              size={14}
              color={theme.colors.foregroundMuted}
            />
            <Text accessibilityLabel={`${comments} comments`} style={muted}>{comments}</Text>
          </NotraButton>
          {activityOpen ? (
            <View style={{ paddingHorizontal: 12, gap: 12 }}>
              <NotraButton theme={theme}
                accessibilityRole="button"
                accessibilityLabel="Add all PR activity to chat"
                disabled={!composers.length || !data?.activity.length}
                onPress={() =>
                  addToChat(
                    data!.activity
                      .map(
                        (item) =>
                          `${item.author} ${item.kind === "review" ? item.state.toLowerCase().replaceAll("_", " ") : "commented"}:\n${item.body}`,
                      )
                      .join("\n\n"),
                  )
                }
                style={{
                  flexDirection: "row",
                  gap: 6,
                  alignItems: "center",
                  paddingVertical: 8,
                  opacity: composers.length ? 1 : 0.5,
                }}
              >
                <Icon
                  name="MessageSquarePlus"
                  size={15}
                  color={theme.colors.foregroundMuted}
                />
                <Text style={muted}>Add all to chat</Text>
              </NotraButton>
              {data?.limited ? (
                <Text style={muted}>
                  Showing a limited activity preview; view the PR for the full
                  history
                </Text>
              ) : null}
              {data && !data.activity.length ? (
                <Text style={muted}>No comments or reviews yet</Text>
              ) : null}
              {data?.activity.map((item) => (
                <NotraDisclosure
                  key={item.id}
                  theme={theme}
                  label={`Toggle ${item.author}'s activity ${item.id}`}
                  title={<>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        backgroundColor: theme.colors.surface2,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={text}>
                        {item.author.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ ...text, flexShrink: 1, fontWeight: "600" }}>
                      {item.author}
                    </Text>
                    <Text style={{ ...muted, flex: 1 }}>
                      {item.kind === "review"
                        ? item.state.toLowerCase().replaceAll("_", " ")
                        : "commented"}
                    </Text>
                    <Text style={{ ...muted, fontSize: 12 }}>
                      {new Date(item.time).toLocaleDateString()}
                    </Text>
                  </View>
                    <Text numberOfLines={1} style={muted}>{item.body || item.state.toLowerCase().replaceAll("_", " ")}</Text>
                  </>}
                >
                  <View>
                    {item.body ? (
                      <Markdown>{item.body}</Markdown>
                    ) : (
                      <Text style={muted}>
                        {item.state.toLowerCase().replaceAll("_", " ")}
                      </Text>
                    )}
                  </View>
                  <NotraButton theme={theme}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.author}'s activity to chat`}
                    disabled={!composers.length}
                    onPress={() => addToChat(`${item.author}:\n${item.body}`)}
                    style={{
                      padding: 12,
                      flexDirection: "row",
                      gap: 6,
                      alignItems: "center",
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                      opacity: composers.length ? 1 : 0.5,
                    }}
                  >
                    <Icon
                      name="MessageSquarePlus"
                      size={15}
                      color={theme.colors.foregroundMuted}
                    />
                    <Text style={muted}>Add to chat</Text>
                  </NotraButton>
                </NotraDisclosure>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
