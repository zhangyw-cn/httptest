import type { LeftView } from "./activity";

export type Shortcut =
  | "send"
  | "save"
  | "toggle-panel"
  | "escape"
  | "block-browser-save";

export function shortcutFromEvent(
  e: { key: string; ctrlKey: boolean; metaKey: boolean },
  opts: { dialogOpen: boolean },
): Shortcut | null {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key;

  if (opts.dialogOpen) {
    if (key === "Escape") return "escape";
    if (mod && (key === "s" || key === "S")) return "block-browser-save";
    return null;
  }

  if (key === "Escape") return "escape";
  if (mod && key === "Enter") return "send";
  if (mod && (key === "s" || key === "S")) return "save";
  if (mod && (key === "b" || key === "B")) return "toggle-panel";
  return null;
}

export function shouldSendOnEnter(view: LeftView): boolean {
  return view === "collection" || view === "history";
}

/** Whether Ctrl+S should run a save action for this left view. */
export function shouldSaveOnCtrlS(view: LeftView): boolean {
  return (
    view === "collection" ||
    view === "history" ||
    view === "environment" ||
    view === "override" ||
    view === "hosts"
  );
}
