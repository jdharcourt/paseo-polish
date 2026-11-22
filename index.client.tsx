import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";
import {
  AppearanceItem,
  AppearanceScreen,
  AppearanceSettings,
} from "./client/appearance";
import { colorSchemes } from "./client/color-schemes";
import {
  getAppearance,
  mountAppearance,
  subscribeAppearance,
} from "./client/web";

// Paseo requires a default export for runtime entrypoints.
export default function contribute(client: PluginClientContext) {
  const unmount = mountAppearance();
  let scheme = getAppearance().values.scheme;
  let removeTheme = client.addTheme({
    id: "polish",
    name: "Paseo Polish",
    ...colorSchemes[scheme],
  });
  const mobileThemes = Platform.OS === "web" ? [] : [
    client.addTheme({ id: "charcoal", name: "Paseo Polish · Charcoal", ...colorSchemes.charcoal }),
    client.addTheme({ id: "paper", name: "Paseo Polish · Paper", ...colorSchemes.paper }),
  ];
  const unsubscribe = subscribeAppearance(() => {
    const next = getAppearance().values.scheme;
    if (next === scheme) return;
    scheme = next;
    removeTheme();
    removeTheme = client.addTheme({
      id: "polish",
      name: "Paseo Polish",
      ...colorSchemes[scheme],
    });
  });
  client.addSettingsScreen({
    id: "appearance",
    title: "Appearance",
    icon: "Palette",
    Component: AppearanceSettings,
  });
  client.addScreen({
    id: "appearance",
    title: "Paseo Polish",
    Component: AppearanceScreen,
  });
  client.addSidebarFooterItem({
    id: "appearance",
    title: "Paseo Polish",
    Component: AppearanceItem,
  });
  client.addCommandCenterItem({
    id: "appearance",
    title: "Customize chat appearance",
    icon: "Palette",
    context: "global",
    onSelect({ openSettings }) {
      openSettings("appearance");
    },
  });
  client.addSlashCommand({
    name: "appearance",
    description: "Customize chat background and layout",
    argumentHint: "",
    context: "workspace",
    onSubmit({ openSettings }) {
      openSettings("appearance");
    },
  });
  return () => {
    unsubscribe();
    removeTheme();
    for (const remove of mobileThemes) remove();
    unmount();
  };
}
