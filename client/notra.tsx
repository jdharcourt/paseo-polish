import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";

export function NotraButton({ theme, style, ...props }: PressableProps & Pick<PluginWorkspacePanelProps, "theme">) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...props}
      accessibilityRole={props.accessibilityRole ?? "button"}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={(state) => [
        { minHeight: 36, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, justifyContent: "center", backgroundColor: state.pressed || hovered ? theme.colors.surface2 : "transparent", opacity: props.disabled ? 0.45 : 1 },
        typeof style === "function" ? style(state) : style,
        props.disabled ? { opacity: 0.45 } : {},
        focused ? { outlineWidth: 2, outlineColor: theme.colors.accent, outlineOffset: -2 } : {},
      ]}
    />
  );
}

export function NotraDisclosure({ theme, title, label, children }: Pick<PluginWorkspacePanelProps, "theme"> & { title: ReactNode; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <NotraButton theme={theme} accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 }}>
        <Icon name={open ? "ChevronDown" : "ChevronRight"} size={16} color={theme.colors.foregroundMuted} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{title}</View>
      </NotraButton>
      {open ? <View style={{ padding: 12, paddingTop: 0, gap: 12 }}>{children}</View> : null}
    </View>
  );
}
