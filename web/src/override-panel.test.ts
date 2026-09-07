import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LABEL,
  ACTIVITY_VIEWS,
  clickActivityIcon,
  isActivityPressed,
} from "./activity";
import { overrideRowStates } from "./override";

describe("override panel", () => {
  it("exposes all four activity views with labels and pressed state", () => {
    expect(ACTIVITY_VIEWS).toEqual([
      "collection",
      "history",
      "environment",
      "override",
    ]);
    expect(ACTIVITY_VIEWS.map((view) => ACTIVITY_LABEL[view])).toEqual([
      "集合",
      "历史",
      "环境",
      "覆盖",
    ]);
    expect(
      ACTIVITY_VIEWS.map((view) =>
        isActivityPressed("override", true, view),
      ),
    ).toEqual([false, false, false, true]);
    expect(
      ACTIVITY_VIEWS.map((view) => clickActivityIcon({ view: "override", panelOpen: true }, view).view),
    ).toEqual(["collection", "history", "environment", "override"]);
  });

  it("puts the send badge only on activeOverride, not editingOverride", () => {
    expect(
      overrideRowStates(["default", "debug"], "default", "debug"),
    ).toEqual([
      { name: "default", itemClassName: "req-item", showSendBadge: true },
      { name: "debug", itemClassName: "req-item active", showSendBadge: false },
    ]);
  });

  it("maps override rows without coupling selection to the send override", () => {
    const rows = overrideRowStates(["default", "debug"], "default", null);
    expect(rows.map((row) => row.name)).toEqual(["default", "debug"]);
    expect(rows.filter((row) => row.showSendBadge).map((row) => row.name)).toEqual([
      "default",
    ]);
  });
});
