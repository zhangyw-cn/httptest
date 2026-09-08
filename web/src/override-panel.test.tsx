import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";
import { clickActivityIcon } from "./activity";
import { overrideRowStates } from "./override";

describe("override panel", () => {
  it("renders top activity buttons and 设置", () => {
    const markup = renderToStaticMarkup(
      <ActivityBar
        view="override"
        panelOpen={true}
        onClickIcon={vi.fn()}
      />,
    );
    expect(markup).toContain('aria-label="集合"');
    expect(markup).toContain('aria-label="历史"');
    expect(markup).toContain('aria-label="环境"');
    expect(markup).toContain('aria-label="覆盖"');
    expect(markup).toContain('aria-label="设置"');
    expect(markup).toContain('aria-pressed="true"');
  });

  it("switches activity view via clickActivityIcon", () => {
    expect(
      clickActivityIcon({ view: "collection", panelOpen: true }, "override"),
    ).toEqual({ view: "override", panelOpen: true });
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
