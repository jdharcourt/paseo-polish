import type {
  PluginScreenProps,
  PluginSidebarItemProps,
  PluginSurfaceProps,
} from "@getpaseo/plugin/client";
import {
  ExternalLink,
  ScrollView,
  SettingsAction,
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
  SidebarRow,
} from "@getpaseo/plugin/client/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Image, Platform, Text, View } from "react-native";
import { NotraButton } from "./notra";
import { preferencesSchema, type Preferences } from "./preferences";
import spaceBackgrounds from "./space-images.json";
import {
  chooseBackground,
  getAppearance,
  saveAppearance,
  setAppearanceTheme,
  subscribeAppearance,
} from "./web";

export function AppearanceItem({
  currentScreen,
  openScreen,
  theme,
}: PluginSidebarItemProps) {
  useEffect(
    () => setAppearanceTheme(theme.colors.surface0, theme.colors.accent),
    [theme],
  );
  return (
    <SidebarRow
      icon="Palette"
      active={currentScreen?.screenId === "appearance"}
      onPress={() => openScreen({ screenId: "appearance" })}
    />
  );
}

export function AppearanceScreen(props: PluginScreenProps) {
  return (
    <ScrollView style={{ flex: 1 }}>
      <AppearanceSettings {...props} />
    </ScrollView>
  );
}

export function AppearanceSettings({ theme, layout }: PluginSurfaceProps) {
  useEffect(
    () => setAppearanceTheme(theme.colors.surface0, theme.colors.accent),
    [theme],
  );
  const { values, error: readError } = useSyncExternalStore(
    subscribeAppearance,
    getAppearance,
    getAppearance,
  );
  const image = values.background === "custom" ? values.image : spaceBackgrounds[values.background].image;
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState("");
  const update = (patch: Partial<Preferences>) => {
    try {
      saveAppearance(patch);
      setError("");
      setNotice("Appearance saved on this device.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save appearance.",
      );
    }
  };
  const upload = async () => {
    setPicking(true);
    setError("");
    setNotice("");
    try {
      if (await chooseBackground())
        setNotice("Background saved on this device.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not open this image.",
      );
    } finally {
      setPicking(false);
    }
  };
  return (
    <View
      testID="polish-settings"
      style={{
        padding: layout.compact ? 16 : 24,
        width: "100%",
        maxWidth: 840,
        alignSelf: "center",
      }}
    >
      <View style={{ gap: 8, marginBottom: 24 }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontSize: 20,
            fontWeight: "600",
          }}
        >
          Appearance
        </Text>
        <Text
          style={{
            color: theme.colors.foregroundMuted,
            fontSize: 14,
            lineHeight: 21,
          }}
        >
          Customize the interface and optional wallpaper. Changes apply immediately
          and stay on this device.
        </Text>
      </View>
      <SettingsSection title="Theme">
        <SettingsCard>
          {Platform.OS === "web" ? (
            <SettingsSelect
              label="Color scheme"
              value={values.scheme}
              options={[
                { label: "Graphite", value: "graphite" },
                { label: "Charcoal", value: "charcoal" },
                { label: "Paper", value: "paper" },
              ]}
              onValueChange={(scheme) => update({ scheme })}
            />
          ) : null}
          <SettingsRow
            label="Paseo Polish theme"
            hint={Platform.OS === "web"
              ? "Select Paseo Polish once in Settings → Appearance to use these colors throughout the app."
              : "Choose Paseo Polish (Graphite), Paseo Polish · Charcoal, or Paseo Polish · Paper in Settings → Appearance. Your choice stays saved on this device."}
          />
        </SettingsCard>
      </SettingsSection>
      {Platform.OS !== "web" ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14, lineHeight: 21 }}>
            Polish colors work throughout the mobile app. For image backgrounds,
            animated ASCII, and custom button styling, use Paseo in your mobile
            browser. Choose a background there; appearance stays on each device.
          </Text>
          <ExternalLink href="https://app.paseo.sh/" accessibilityLabel="Open Paseo in your browser">
            <Text style={{ color: theme.colors.accent, fontSize: 16, lineHeight: 24, paddingVertical: 10 }}>
              Open Paseo in your browser
            </Text>
          </ExternalLink>
        </View>
      ) : (
        <>
          <SettingsSection title="Chat layout">
            <SettingsCard>
              <SettingsSwitch
                label="UI polish"
                hint="Rounded buttons, inset text fields, and full-width conversations."
                value={values.enabled}
                onValueChange={(enabled) => update({ enabled })}
              />
              <SettingsSelect
                label="Conversation width"
                value={values.width}
                options={[
                  { label: "Focused", value: "focused" },
                  { label: "Wide", value: "wide" },
                  { label: "Full width", value: "full" },
                ]}
                onValueChange={(width) => update({ width })}
                disabled={!values.enabled}
              />
              <SettingsSelect
                label="Message spacing"
                value={values.spacing}
                options={[
                  { label: "Comfortable", value: "comfortable" },
                  { label: "Compact", value: "compact" },
                ]}
                onValueChange={(spacing) => update({ spacing })}
                disabled={!values.enabled}
              />
            </SettingsCard>
          </SettingsSection>
          <SettingsSection title="Chat background">
            <View style={{ gap: 12 }}>
              <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14, lineHeight: 21 }}>
                Space photographs and designs from the Devault ASCII library. Animated options play when animation is enabled.
              </Text>
              <View accessibilityLabel="ASCII backgrounds" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {Object.entries(spaceBackgrounds).map(([id, background]) => (
                  <NotraButton theme={theme}
                    key={id}
                    testID={`polish-background-${id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${background.name}${values.background === id && values.wallpaperEnabled ? ", selected" : ""}`}
                    accessibilityState={{ disabled: !values.enabled }}
                    disabled={!values.enabled}
                    onPress={() => update({ background: id as Exclude<Preferences["background"], "custom">, wallpaperEnabled: true, animated: Boolean(background.video), visibility: 20 })}
                    style={{ width: layout.compact ? "100%" : "48%", borderWidth: 1, borderColor: values.background === id && values.wallpaperEnabled ? theme.colors.foreground : theme.colors.border, borderRadius: 8, overflow: "hidden", opacity: values.enabled ? 1 : 0.5 }}
                  >
                    <Image source={{ uri: background.image }} resizeMode="cover" accessible={false} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#080808" }} />
                    <View style={{ padding: 12, flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>{background.name}</Text>
                      {values.background === id && values.wallpaperEnabled ? <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14 }}>Selected</Text> : null}
                    </View>
                  </NotraButton>
                ))}
              </View>
              <View
                testID="polish-background-preview"
                accessibilityLabel="Chat appearance preview"
                style={{
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 8,
                  backgroundColor: theme.colors.surface0,
                  minHeight: layout.compact ? 200 : 280,
                  aspectRatio: 16 / 9,
                }}
              >
                {image && values.enabled && values.wallpaperEnabled ? (
                  <Image
                    source={{ uri: image }}
                    testID="polish-preview-image"
                    resizeMode="cover"
                    accessible={false}
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "100%",
                      opacity: values.visibility / 100,
                    }}
                  />
                ) : null}
                <View
                  style={{
                    padding: layout.compact ? 16 : 24,
                    gap: values.spacing === "comfortable" ? 16 : 8,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: theme.colors.surface2,
                      padding: 12,
                      borderRadius: 8,
                      alignSelf: "flex-end",
                      maxWidth: "85%",
                    }}
                  >
                    <Text
                      style={{ color: theme.colors.foreground, fontSize: 14 }}
                    >
                      Review the changes before opening a PR.
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingVertical: 8,
                      alignSelf: "flex-start",
                      maxWidth: "90%",
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.foreground,
                        fontSize: 14,
                        lineHeight: 22,
                      }}
                    >
                      The diff is ready to review. I'll wait before publishing.
                    </Text>
                  </View>
                </View>
              </View>
              {values.background !== "custom" ? (
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14, lineHeight: 21 }}>
                  Source: {spaceBackgrounds[values.background].credit}. ASCII background.
                </Text>
              ) : null}
              <SettingsCard>
                <SettingsSwitch
                  label="Show wallpaper"
                  hint="Switch off for a plain surface. Your selection and uploaded image stay saved."
                  value={values.wallpaperEnabled}
                  onValueChange={(wallpaperEnabled) => update({ wallpaperEnabled })}
                  disabled={!image || !values.enabled}
                />
                <SettingsAction
                  label="Background image"
                  hint="JPEG, PNG, or WebP, up to 8 MB. Resized locally; never sent to an agent or server."
                  actionLabel={
                    picking
                      ? "Choosing…"
                      : values.image
                        ? "Replace image"
                        : "Choose image"
                  }
                  onPress={upload}
                  disabled={picking}
                />
                {values.image && values.background !== "custom" ? (
                  <SettingsAction
                    label="Your uploaded image"
                    actionLabel="Use uploaded image"
                    onPress={() => update({ background: "custom", wallpaperEnabled: true })}
                    disabled={!values.enabled}
                  />
                ) : null}
                {values.image ? (
                  <SettingsAction
                    label="Uploaded image"
                    actionLabel="Remove uploaded image"
                    onPress={() => update({ image: null, wallpaperEnabled: values.background !== "custom" && values.wallpaperEnabled })}
                    disabled={picking}
                  />
                ) : null}
                <SettingsSelect
                  label="Character size"
                  hint="Smaller characters reveal finer detail."
                  value={String(values.characterSize)}
                  options={[
                    { label: "Very fine · 4 px", value: "4" },
                    { label: "Fine · 6 px", value: "6" },
                    { label: "Medium · 8 px", value: "8" },
                    { label: "Large · 12 px", value: "12" },
                    { label: "Extra large · 16 px", value: "16" },
                    { label: "Coarse · 20 px", value: "20" },
                  ]}
                  onValueChange={(characterSize) => update({ characterSize: Number(characterSize) })}
                  disabled={values.background === "custom" || !values.enabled || !values.wallpaperEnabled}
                />
                <SettingsSelect
                  label="Artwork scale"
                  value={String(values.backgroundScale)}
                  options={[
                    { label: "Fill window · 100%", value: "100" },
                    { label: "Zoom · 125%", value: "125" },
                    { label: "Zoom · 150%", value: "150" },
                    { label: "Zoom · 200%", value: "200" },
                  ]}
                  onValueChange={(backgroundScale) => update({ backgroundScale: Number(backgroundScale) })}
                  disabled={values.background === "custom" || !values.enabled || !values.wallpaperEnabled}
                />
                <SettingsSwitch
                  label="Animate ASCII"
                  hint="Scene-specific motion: lunar drift, circulating rings, rotating galaxy arms, and layered nebula gas. Respects reduced motion."
                  value={values.animated}
                  onValueChange={(animated) => update({ animated })}
                  disabled={values.background === "custom" || !values.enabled || !values.wallpaperEnabled}
                />
                <SettingsSwitch
                  label="React to cursor"
                  hint="Move the ASCII around your pointer. Respects reduced motion."
                  value={values.interactive}
                  onValueChange={(interactive) => update({ interactive })}
                  disabled={values.background === "custom" || !values.enabled || !values.wallpaperEnabled}
                />
                {values.interactive ? (
                  <>
                    <SettingsSelect
                      label="Cursor effect"
                      value={values.cursorForce}
                      options={[
                        { label: "Push away", value: "push" },
                        { label: "Pull in", value: "pull" },
                      ]}
                      onValueChange={(cursorForce) => update({ cursorForce })}
                      disabled={values.background === "custom" || !values.enabled || !values.wallpaperEnabled}
                    />
                    <SettingsSelect
                      label="Strength"
                      value={String(values.cursorStrength)}
                      options={[
                        { label: "Gentle", value: "25" },
                        { label: "Normal", value: "50" },
                        { label: "Strong", value: "100" },
                      ]}
                      onValueChange={(cursorStrength) => update({ cursorStrength: Number(cursorStrength) })}
                      disabled={values.background === "custom" || !values.enabled || !values.wallpaperEnabled}
                    />
                    <SettingsSelect
                      label="Trail"
                      value={String(values.cursorTrail)}
                      options={[
                        { label: "Off", value: "0" },
                        { label: "Short", value: "25" },
                        { label: "Medium", value: "50" },
                        { label: "Long", value: "100" },
                      ]}
                      onValueChange={(cursorTrail) => update({ cursorTrail: Number(cursorTrail) })}
                      disabled={values.background === "custom" || !values.enabled || !values.wallpaperEnabled}
                    />
                    <SettingsSelect
                      label="Bounce"
                      hint="How the characters spring back into place."
                      value={String(values.cursorBounce)}
                      options={[
                        { label: "Off", value: "0" },
                        { label: "Soft", value: "35" },
                        { label: "Springy", value: "75" },
                      ]}
                      onValueChange={(cursorBounce) => update({ cursorBounce: Number(cursorBounce) })}
                      disabled={values.background === "custom" || !values.enabled || !values.wallpaperEnabled}
                    />
                  </>
                ) : null}
                <SettingsSelect
                  label="Image visibility"
                  hint="Use a low value to keep the conversation readable."
                  value={String(values.visibility)}
                  options={[
                    { label: "Subtle · 10%", value: "10" },
                    { label: "Balanced · 20%", value: "20" },
                    { label: "Visible · 40%", value: "40" },
                    { label: "Strong · 70%", value: "70" },
                    { label: "Full · 100%", value: "100" },
                  ]}
                  onValueChange={(visibility) =>
                    update({ visibility: Number(visibility) })
                  }
                  disabled={!image || !values.enabled || !values.wallpaperEnabled}
                />
                <SettingsSelect
                  label="Image position"
                  value={values.position}
                  options={[
                    { label: "Center", value: "center" },
                    { label: "Top", value: "top" },
                    { label: "Bottom", value: "bottom" },
                  ]}
                  onValueChange={(position) => update({ position })}
                  disabled={!image || !values.enabled || !values.wallpaperEnabled}
                />
              </SettingsCard>
            </View>
          </SettingsSection>
          {error || readError ? (
            <Text
              accessibilityRole="alert"
              style={{
                color: theme.colors.statusDanger,
                fontSize: 14,
                lineHeight: 21,
              }}
            >
              {error || readError}
            </Text>
          ) : notice ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: theme.colors.foregroundMuted, fontSize: 14 }}
            >
              {notice}
            </Text>
          ) : null}
          <NotraButton theme={theme}
            accessibilityRole="button"
            disabled={picking}
            accessibilityState={{ disabled: picking }}
            onPress={() => update(preferencesSchema.parse({}))}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 8,
              opacity: picking ? 0.5 : 1,
            }}
          >
            <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>
              Reset appearance
            </Text>
          </NotraButton>
        </>
      )}
    </View>
  );
}
