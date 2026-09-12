import { describe, expect, it } from "vitest";
import {
  shortcutFromEvent,
  shouldSaveOnCtrlS,
  shouldSendOnEnter,
} from "./shortcut";

function ev(
  key: string,
  mods: { ctrl?: boolean; meta?: boolean } = {},
): { key: string; ctrlKey: boolean; metaKey: boolean } {
  return { key, ctrlKey: !!mods.ctrl, metaKey: !!mods.meta };
}

describe("shortcutFromEvent", () => {
  it("treats Ctrl+Enter as send and plain Enter as nothing", () => {
    expect(shortcutFromEvent(ev("Enter", { ctrl: true }), { dialogOpen: false })).toBe(
      "send",
    );
    expect(shortcutFromEvent(ev("Enter"), { dialogOpen: false })).toBeNull();
  });

  it("treats Cmd+S as save", () => {
    expect(shortcutFromEvent(ev("s", { meta: true }), { dialogOpen: false })).toBe(
      "save",
    );
    expect(shortcutFromEvent(ev("S", { ctrl: true }), { dialogOpen: false })).toBe(
      "save",
    );
  });

  it("treats Ctrl+B as toggle-panel", () => {
    expect(shortcutFromEvent(ev("b", { ctrl: true }), { dialogOpen: false })).toBe(
      "toggle-panel",
    );
  });

  it("returns escape when the dialog is closed", () => {
    expect(shortcutFromEvent(ev("Escape"), { dialogOpen: false })).toBe("escape");
  });

  it("suppresses send save and toggle while a dialog is open", () => {
    expect(
      shortcutFromEvent(ev("Enter", { ctrl: true }), { dialogOpen: true }),
    ).toBeNull();
    expect(shortcutFromEvent(ev("b", { ctrl: true }), { dialogOpen: true })).toBeNull();
    expect(shortcutFromEvent(ev("s", { ctrl: true }), { dialogOpen: true })).toBe(
      "block-browser-save",
    );
    expect(shortcutFromEvent(ev("Escape"), { dialogOpen: true })).toBe("escape");
  });
});

describe("shouldSendOnEnter", () => {
  it("sends only from collection and history views", () => {
    expect(shouldSendOnEnter("collection")).toBe(true);
    expect(shouldSendOnEnter("history")).toBe(true);
    expect(shouldSendOnEnter("environment")).toBe(false);
    expect(shouldSendOnEnter("override")).toBe(false);
    expect(shouldSendOnEnter("hosts")).toBe(false);
    expect(shouldSendOnEnter("settings")).toBe(false);
  });
});

describe("shouldSaveOnCtrlS", () => {
  it("saves from all views except settings", () => {
    expect(shouldSaveOnCtrlS("collection")).toBe(true);
    expect(shouldSaveOnCtrlS("history")).toBe(true);
    expect(shouldSaveOnCtrlS("environment")).toBe(true);
    expect(shouldSaveOnCtrlS("override")).toBe(true);
    expect(shouldSaveOnCtrlS("hosts")).toBe(true);
    expect(shouldSaveOnCtrlS("settings")).toBe(false);
  });
});
