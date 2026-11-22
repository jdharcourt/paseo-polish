import { Platform } from "react-native";
import { mountAsciiBackground, type AsciiTarget } from "./ascii.web";
import spaceBackgrounds from "./space-images.json";
import typefaces from "./typefaces.json";
import {
  detectImageType,
  preferencesSchema,
  type Preferences,
} from "./preferences";

type Element = AsciiTarget & {
  tagName: string;
  parentElement: Element | null;
  textContent: string | null;
  querySelector(selector: string): Element | null;
  querySelectorAll(selector: string): Element[];
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  remove(): void;
};
type ImageFile = {
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};
type FileInput = Element & {
  type: string;
  accept: string;
  hidden: boolean;
  files: ImageFile[] | null;
  onchange: (() => void) | null;
  oncancel: (() => void) | null;
  click(): void;
};
type Canvas = {
  width: number;
  height: number;
  getContext(kind: "2d"): {
    drawImage(
      image: DecodedImage,
      x: number,
      y: number,
      width: number,
      height: number,
    ): void;
  } | null;
  toDataURL(type: string, quality: number): string;
};
type DecodedImage = {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  onload: (() => void) | null;
  onerror: (() => void) | null;
};

declare const document: {
  documentElement: Element;
  querySelectorAll(selector: string): Element[];
  head: { appendChild(element: Element): void };
  body: Element & { appendChild(element: Element): void };
  createElement(tag: "style"): Element;
  createElement(tag: "input"): FileInput;
  createElement(tag: "canvas"): Canvas;
};
declare const window: {
  localStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  addEventListener(
    event: "storage",
    callback: (event: { key: string | null }) => void,
  ): void;
  removeEventListener(
    event: "storage",
    callback: (event: { key: string | null }) => void,
  ): void;
};
declare const URL: {
  createObjectURL(blob: ImageFile): string;
  revokeObjectURL(url: string): void;
};
declare const Image: new () => DecodedImage;
declare const MutationObserver: new (callback: () => void) => {
  observe(
    element: Element,
    options: { childList: boolean; subtree: boolean },
  ): void;
  disconnect(): void;
};

const key = "paseo-polish:v1";
const listeners = new Set<() => void>();
let snapshot = { values: preferencesSchema.parse({}), error: "" };
let style: Element | null = null;
let pendingPicker: (() => void) | null = null;
let themeCss = "";
let generation = 0;

export function getAppearance() {
  return snapshot;
}

export function subscribeAppearance(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setAppearanceTheme(surface: string, ring: string) {
  if (Platform.OS !== "web") return;
  if (
    ![surface, ring].every(
      (color) =>
        /^#[0-9a-f]{3,8}$/i.test(color) || /^rgba?\([\d\s.,%]+\)$/.test(color),
    )
  )
    return;
  themeCss = `html[data-paseo-polish] { --polish-surface:${surface}; --polish-ring:${ring}; }`;
  if (style) style.textContent = themeCss + appearanceCss(snapshot.values);
}

export function appearanceCss(values: Preferences) {
  if (!values.enabled) return "";
  const image = values.background === "custom" ? values.image : spaceBackgrounds[values.background].image;
  return `
@font-face { font-family:"Paseo Geist"; font-style:normal; font-display:swap; font-weight:100 900; src:url("${typefaces.sans}") format("woff2"); }
@font-face { font-family:"Paseo Geist Mono"; font-style:normal; font-display:swap; font-weight:100 900; src:url("${typefaces.mono}") format("woff2"); }
html[data-paseo-polish] { --fontFamily-mono:"Paseo Geist Mono",ui-monospace,Menlo,Consolas,monospace !important; --fontFamily-ui:"Paseo Geist",-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif !important; --paseo-ui-font:var(--fontFamily-ui) !important; --content-max-width:${{ focused: "880px", wide: "1080px", full: "100%" }[values.width]} !important; }
html[data-paseo-polish] :is(button,[role="button"],input,select,textarea,[role="combobox"]) {
  border-radius:10px !important; box-shadow:none !important;
}
html[data-paseo-polish] :is(button,[role="button"],input,select,textarea,[role="combobox"],a):focus-visible {
  outline:2px solid var(--polish-ring, currentColor) !important; outline-offset:2px;
}
html[data-paseo-polish] :is([role="dialog"],[role="menu"],[role="listbox"]) {
  border-radius:8px !important; border-color:var(--colors-border) !important;
  box-shadow:0 2px 8px rgba(0,0,0,.1) !important;
}
html[data-paseo-polish] :is([role="menuitem"],[role="option"]) {
  border-radius:6px !important; min-height:32px; font-size:14px !important;
}
html[data-paseo-polish] :is([role="menuitem"],[role="option"]):not([aria-disabled="true"]):hover {
  background-color:var(--colors-surface2) !important;
}
html[data-paseo-polish] :is(input,textarea,[role="combobox"]):not([type="range"],[type="checkbox"],[type="radio"],[type="file"]) {
  border:1px solid var(--colors-border) !important; background-color:var(--colors-surface1) !important;
  color:var(--colors-foreground) !important; padding:8px 10px; font-size:14px !important;
}
html[data-paseo-polish] [data-testid="agent-chat-scroll"] > div {
  width:100%; max-width:var(--content-max-width); margin-inline:0 !important;
  padding:16px 24px !important;
}
html[data-paseo-polish] [data-history-row-id] > div {
  max-width:100% !important; align-self:stretch !important; padding-inline:0 !important;
}
html[data-paseo-polish] [data-testid="assistant-message"] {
  background:transparent !important; border:0 !important; border-radius:6px !important;
  padding:${values.spacing === "comfortable" ? "12px 0" : "8px 0"} !important;
}
html[data-paseo-polish] [data-message-text="true"] {
  font-family:var(--fontFamily-ui) !important; font-size:14px !important; line-height:1.65 !important;
}
html[data-paseo-polish] [data-message-text="true"] :is(p,li) { line-height:1.6 !important; }
html[data-paseo-polish] [data-testid="user-message"] { padding-block:8px !important; }
html[data-paseo-polish] [data-testid="user-message"] > div { max-width:min(85%,720px) !important; }
html[data-paseo-polish] [data-testid="user-message"] > div > div {
  border-radius:6px !important; padding:10px 12px !important;
}
html[data-paseo-polish] :is([data-chat-rail-active="true"],[data-paseo-polish-chat]) {
  --paseo-chat-rail-left:24px !important; --paseo-chat-rail-right:24px !important;
}
html[data-paseo-polish] [data-chat-rail-lane="true"] { padding-inline:24px !important; }
html[data-paseo-polish] [data-testid="message-input-root"] {
  border:0 !important; border-radius:0 !important; background:transparent !important;
  box-shadow:none !important; outline:none !important;
}
html[data-paseo-polish] [data-testid="message-input-root"] > div > div > div {
  border-radius:12px !important; border:1px solid var(--colors-border) !important;
  background-color:var(--colors-surface1) !important; box-shadow:0 0 0 2px var(--colors-surface0) !important;
}
html[data-paseo-polish] [data-testid="message-input-root"] > div > div > div:focus-within {
  border-color:var(--colors-foreground-muted) !important;
}
html[data-paseo-polish] [data-testid="message-input-root"] :is(textarea,[contenteditable="true"]) {
  font-size:14px !important; line-height:22px !important; outline:none !important;
  border:0 !important; background:transparent !important; padding:0 !important;
}
html[data-paseo-polish] [data-testid="message-input-root"] button > div { border-radius:inherit !important; }
html[data-paseo-polish] [data-testid="agent-controls-toolbar"] [role="button"] {
  min-height:28px; padding-inline:8px !important; border-radius:10px !important;
  background-color:transparent; border:0 !important;
}
html[data-paseo-polish] :is([data-testid="agent-controls-toolbar"],[data-testid="sidebar-nav-scroll"],[data-testid="sidebar-footer"]) [role="button"]:not([aria-disabled="true"]):hover,
html[data-paseo-polish] :is([data-testid="message-input-attach-button"],[data-testid="workspace-new-tab-button"],[data-testid="workspace-header-menu-trigger"]):hover {
  background-color:var(--colors-surface2) !important;
}
html[data-paseo-polish] [data-testid="message-input-attach-button"] {
  width:28px !important; height:28px !important; border-radius:10px !important;
}
html[data-paseo-polish] [data-testid="workspace-tabs-row"] {
  min-height:40px !important; background-color:var(--colors-surface0) !important;
}
html[data-paseo-polish] [data-testid^="workspace-tab-"][role="button"] {
  height:30px !important; border:1px solid transparent !important; padding-inline:10px !important;
}
html[data-paseo-polish] [data-testid^="workspace-tab-"][role="button"][aria-selected="true"] {
  background-color:var(--colors-surface2) !important; border-color:var(--colors-border) !important;
}
html[data-paseo-polish] [data-testid^="workspace-tab-"][role="button"]:not([aria-selected="true"]):hover {
  background-color:var(--colors-surface1) !important;
}
html[data-paseo-polish] :is(pre,pre code,[data-pmono],[data-testid="provider-update-output"]),
html[data-paseo-polish] [data-message-text="true"] div:has(> pre) {
  border-radius:8px !important; box-shadow:none !important;
}
html[data-paseo-polish] :is([data-testid="tool-call-badge"],[data-testid="tool-call-group"]) {
  border-radius:8px !important; margin-block:4px !important;
}
html[data-paseo-polish] :is([data-testid="tool-call-badge"],[data-testid="tool-call-group"]) > div {
  border-radius:8px !important;
}
html[data-paseo-polish] [data-testid="tool-call-badge"] [role="button"] {
  border-radius:6px !important; min-height:32px;
}
html[data-paseo-polish] :is([data-testid^="sidebar-workspace-row-"],[data-testid^="sidebar-project-row-"]) {
  border-radius:6px !important; min-height:32px;
}
html[data-paseo-polish] [data-testid="sidebar-nav-scroll"] [role="button"] { border-radius:6px !important; }
html[data-paseo-polish] [data-testid="sidebar-footer"] [role="button"] { border-radius:6px !important; }
html[data-paseo-polish] [data-testid^="workspace-tab-"][role="button"] {
  border-radius:10px !important; box-shadow:none !important;
}
html[data-paseo-polish] [data-testid="workspace-header-subtitle"] { font-size:13px !important; }
${
  image && values.wallpaperEnabled
    ? `
html[data-paseo-polish] [data-paseo-polish-chat] { position:relative; isolation:isolate; }
html[data-paseo-polish] [data-paseo-polish-layer],
html[data-paseo-polish] [data-testid="agent-chat-scroll"] > div { background-color:transparent !important; }
html[data-paseo-polish] [data-paseo-polish-chat]::before {
  content:""; position:absolute; inset:0; pointer-events:none;
  background-image:url("${image}"); background-size:cover;
  background-position:${values.position}; opacity:${values.visibility / 100};
}
html[data-paseo-polish] [data-testid="agent-chat-scroll"] { position:relative; }
html[data-paseo-polish] :is([data-paseo-polish-chat],[data-testid="polish-background-preview"]):has(> [data-paseo-polish-canvas]) { position:relative; isolation:isolate; }
html[data-paseo-polish] [data-paseo-polish-canvas] {
  position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:-1;
  opacity:${values.visibility / 100};
}
html[data-paseo-polish] :not([data-paseo-polish-ascii]) > [data-paseo-polish-canvas] { visibility:hidden; }
html[data-paseo-polish] [data-paseo-polish-ascii]::before { content:none !important; }
html[data-paseo-polish] [data-paseo-polish-ascii] [data-testid="polish-preview-image"] { visibility:hidden; }
html[data-paseo-polish] [data-testid="polish-preview-image"] { background-position:${values.position} !important; }
html[data-paseo-polish] [data-testid="polish-preview-image"] img { object-position:${values.position} !important; }
`
    : ""
}
@media(max-width:600px) {
  html[data-paseo-polish] [data-testid="agent-chat-scroll"] > div { padding-inline:16px !important; }
  html[data-paseo-polish] [data-chat-rail-lane="true"] { padding-inline:16px !important; }
  html[data-paseo-polish] :is([data-chat-rail-active="true"],[data-paseo-polish-chat]) {
    --paseo-chat-rail-left:16px !important; --paseo-chat-rail-right:16px !important;
  }
}
@media(max-width:600px),(pointer:coarse) {
  html[data-paseo-polish] :is([data-testid="agent-controls-toolbar"],[data-testid="polish-settings"]) :is(button,[role="button"],[role="switch"]) { min-height:44px; }
  html[data-paseo-polish] [data-testid="message-input-attach-button"] { width:44px !important; height:44px !important; }
  html[data-paseo-polish] :is([role="menuitem"],[role="option"]) { min-height:44px; }
  html[data-paseo-polish] :is(input,textarea,[contenteditable="true"],[role="combobox"]):not([type="range"],[type="checkbox"],[type="radio"],[type="file"]) { font-size:16px !important; }
  html[data-paseo-polish] [data-testid="message-input-root"] :is(textarea,[contenteditable="true"]) { font-size:16px !important; }
}
@media(min-width:900px) {
  html[data-paseo-polish] div:has(> div > div > [data-testid="left-sidebar-resize-handle"]) {
    width:248px !important; min-width:248px !important; max-width:248px !important;
  }
  html[data-paseo-polish] [data-testid="left-sidebar-resize-handle"] { display:none; }
}
`;
}

export function saveAppearance(patch: Partial<Preferences>) {
  if (Platform.OS !== "web") return;
  const values = preferencesSchema.parse({ ...snapshot.values, ...patch });
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    throw new Error(
      "Could not save appearance on this device. Free browser storage or allow site storage, then try again.",
    );
  }
  snapshot = { values, error: "" };
  if (style) style.textContent = themeCss + appearanceCss(values);
  for (const listener of listeners) listener();
}

export function mountAppearance() {
  if (Platform.OS !== "web") return () => {};
  generation++;
  for (const stale of document.querySelectorAll("[data-paseo-polish-style]")) stale.remove();
  style = document.createElement("style");
  style.setAttribute("data-paseo-polish-style", "");
  document.head.appendChild(style);
  document.documentElement.setAttribute("data-paseo-polish", "");
  const read = () => {
    try {
      const raw = window.localStorage.getItem(key);
      const saved = raw ? JSON.parse(raw) : {};
      const values = preferencesSchema.parse(
        saved.layoutVersion === 2
          ? saved
          : { ...saved, layoutVersion: 2, width: "full", spacing: "compact", wallpaperEnabled: false, visibility: 10 },
      );
      if (raw && saved.layoutVersion !== 2)
        window.localStorage.setItem(key, JSON.stringify(values));
      snapshot = { values, error: "" };
    } catch {
      snapshot = {
        values: preferencesSchema.parse({ enabled: false }),
        error:
          "Saved appearance could not be read. Reset appearance to recover.",
      };
    }
    if (style) style.textContent = themeCss + appearanceCss(snapshot.values);
    for (const listener of listeners) listener();
  };
  read();
  const marked = new Map<Element, Element>();
  const asciiLayers = new Map<Element, NonNullable<ReturnType<typeof mountAsciiBackground>>>();
  let layers = new Set<Element>();
  const markChats = () => {
    const chats = Array.from(
      document.querySelectorAll('[data-testid="agent-chat-scroll"]'),
    );
    for (const [chat, target] of marked) {
      if (chats.includes(chat)) continue;
      target.removeAttribute("data-paseo-polish-chat");
      marked.delete(chat);
    }
    for (const chat of chats) {
      let target = chat.parentElement;
      for (
        let parent = target;
        parent?.tagName === "DIV";
        parent = parent.parentElement
      ) {
        if (!parent.querySelector('[data-testid="message-input-root"]'))
          continue;
        if (
          parent.querySelectorAll('[data-testid="agent-chat-scroll"]')
            .length !== 1
        )
          break;
        target = parent;
        break;
      }
      if (!target || marked.get(chat) === target) continue;
      marked.get(chat)?.removeAttribute("data-paseo-polish-chat");
      target.setAttribute("data-paseo-polish-chat", "");
      marked.set(chat, target);
    }
    const nextLayers = new Set<Element>();
    for (const [chat, target] of marked) {
      for (let node: Element | null = chat; node && node !== target; node = node.parentElement) nextLayers.add(node);
    }
    for (const node of layers) {
      if (!nextLayers.has(node)) node.removeAttribute("data-paseo-polish-layer");
    }
    for (const node of nextLayers) {
      if (!layers.has(node)) node.setAttribute("data-paseo-polish-layer", "");
    }
    layers = nextLayers;
    const targets = new Set(marked.values());
    for (const preview of document.querySelectorAll('[data-testid="polish-background-preview"]')) targets.add(preview);
    const values = snapshot.values;
    for (const [target, renderer] of asciiLayers) {
      if (targets.has(target) && values.enabled && values.wallpaperEnabled && values.background !== "custom") continue;
      renderer.dispose();
      asciiLayers.delete(target);
    }
    if (!values.enabled || !values.wallpaperEnabled || values.background === "custom") return;
    for (const target of targets) {
      const existing = asciiLayers.get(target);
      if (existing) { existing.update(values); continue; }
      const renderer = mountAsciiBackground(target, values);
      if (renderer) asciiLayers.set(target, renderer);
    }
  };
  let active = true;
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    void Promise.resolve().then(() => {
      scheduled = false;
      if (active) markChats();
    });
  });
  markChats();
  const unsubscribe = subscribeAppearance(markChats);
  observer.observe(document.body, { childList: true, subtree: true });
  const onStorage = (event: { key: string | null }) => {
    if (event.key === key || event.key === null) read();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    active = false;
    observer.disconnect();
    unsubscribe();
    for (const renderer of asciiLayers.values()) renderer.dispose();
    asciiLayers.clear();
    for (const target of marked.values())
      target.removeAttribute("data-paseo-polish-chat");
    marked.clear();
    for (const node of layers) node.removeAttribute("data-paseo-polish-layer");
    layers.clear();
    generation++;
    pendingPicker?.();
    pendingPicker = null;
    window.removeEventListener("storage", onStorage);
    style?.remove();
    style = null;
    document.documentElement.removeAttribute("data-paseo-polish");
  };
}

export async function chooseBackground() {
  if (Platform.OS !== "web")
    throw new Error(
      "Custom backgrounds are available in Paseo desktop and web.",
    );
  if (pendingPicker) throw new Error("An image picker is already open.");
  const started = generation;
  const file = await new Promise<ImageFile | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.hidden = true;
    const finish = (file: ImageFile | null) => {
      input.onchange = null;
      input.oncancel = null;
      input.remove();
      pendingPicker = null;
      resolve(file);
    };
    pendingPicker = () => finish(null);
    input.onchange = () => finish(input.files?.[0] ?? null);
    input.oncancel = () => finish(null);
    document.body.appendChild(input);
    input.click();
  });
  if (!file) return;
  if (!file.size || file.size > 8 * 1024 * 1024)
    throw new Error("Choose an image smaller than 8 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (detectImageType(new Uint8Array(await file.arrayBuffer())) !== file.type)
    throw new Error(
      "The file contents do not match its image type. Export the image again and retry.",
    );
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<DecodedImage>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new Error("This image could not be decoded. Try another image."),
        );
      image.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000
    )
      throw new Error("Choose an image smaller than 40 megapixels.");
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      4096 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Image processing is unavailable. Try reopening Paseo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length > 1_800_000) continue;
      if (started !== generation) return;
      saveAppearance({ image: data, background: "custom", wallpaperEnabled: true });
      return true;
    }
    throw new Error(
      "This image is too detailed to store. Try a smaller image.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
