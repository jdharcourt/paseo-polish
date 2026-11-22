import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  openExternalUrl,
  useComposers,
  useRpc,
  type PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
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
  const counts = { success: 0, failure: 0, pending: 0, skipped: 0 };
  for (const check of data?.checks ?? []) counts[check.state]++;
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
      : !data.checks.length
        ? "No checks reported"
        : counts.failure
          ? "Some checks have failed"
          : counts.pending
            ? "Checks are running"
            : counts.success
              ? "All checks have passed"
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
          height: 44,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Pressable
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
        </Pressable>
        <Pressable
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
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 16 }}>
        <View style={{ paddingHorizontal: 12, gap: 12 }}>
          <Text selectable style={{ ...text, fontSize: 17, lineHeight: 24 }}>
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
                pr.state === "MERGED"
                  ? "GitMerge"
                  : pr.state === "CLOSED"
                    ? "GitPullRequestClosed"
                    : "GitPullRequest"
              }
              size={17}
              color={
                pr.state === "OPEN"
                  ? theme.colors.statusSuccess
                  : theme.colors.accent
              }
            />
            <Text
              style={{
                ...text,
                color:
                  pr.state === "OPEN"
                    ? theme.colors.statusSuccess
                    : theme.colors.accent,
              }}
            >
              {pr.state === "MERGED"
                ? "Merged"
                : pr.state === "CLOSED"
                  ? "Closed"
                  : "Open"}
            </Text>
            <Text style={muted}>{pr.url.split("/").slice(3, 5).join("/")}</Text>
          </View>
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
          <Pressable
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
              size={26}
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
          </Pressable>
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
                <Pressable
                  key={state}
                  accessibilityRole="button"
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
                      ? `All ${data.checks.length}`
                      : `${state === "success" ? "Passed" : state === "failure" ? "Failed" : state === "pending" ? "Pending" : "Skipped"} ${counts[state]}`}
                  </Text>
                </Pressable>
              ))}
            </View>
            {data.checks
              .filter((check) => selected === "all" || check.state === selected)
              .map((check, index) => (
                <Pressable
                  key={`${check.name}:${index}`}
                  accessibilityRole="link"
                  accessibilityLabel={`${check.name}: ${check.state}`}
                  disabled={!check.url}
                  onPress={() => void openExternalUrl(check.url)}
                  style={({ pressed }) => ({
                    minHeight: 36,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: pressed
                      ? theme.colors.surface2
                      : "transparent",
                  })}
                >
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
                </Pressable>
              ))}
          </View>
        ) : null}
        <View
          style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle pull request activity"
            accessibilityState={{ expanded: activityOpen }}
            onPress={() => setActivityOpen(!activityOpen)}
            style={{
              height: 44,
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
            <Text style={muted}>{approvals}</Text>
            <Icon
              name="MessageSquare"
              size={14}
              color={theme.colors.foregroundMuted}
            />
            <Text style={muted}>{comments}</Text>
          </Pressable>
          {activityOpen ? (
            <View style={{ paddingHorizontal: 12, gap: 12 }}>
              <Pressable
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
              </Pressable>
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
                <View
                  key={item.id}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: 8,
                  }}
                >
                  <View
                    style={{
                      padding: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.border,
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
                  <View style={{ padding: 12 }}>
                    {item.body ? (
                      <Markdown>{item.body}</Markdown>
                    ) : (
                      <Text style={muted}>
                        {item.state.toLowerCase().replaceAll("_", " ")}
                      </Text>
                    )}
                  </View>
                  <Pressable
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
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
