import { describe, expect, it } from "vitest";
import { clickActivityIcon, togglePanel, type LeftState } from "./activity";

const openCollection: LeftState = { view: "collection", panelOpen: true };

describe("clickActivityIcon", () => {
  it("collapses when clicking the active icon", () => {
    expect(clickActivityIcon(openCollection, "collection")).toEqual({
      view: "collection",
      panelOpen: false,
    });
  });

  it("reopens the same view when clicking the active icon while collapsed", () => {
    expect(
      clickActivityIcon({ view: "collection", panelOpen: false }, "collection"),
    ).toEqual({ view: "collection", panelOpen: true });
  });

  it("switches view and opens when clicking the other icon", () => {
    expect(clickActivityIcon(openCollection, "history")).toEqual({
      view: "history",
      panelOpen: true,
    });
  });

  it("opens history even if the panel was collapsed on collection", () => {
    expect(
      clickActivityIcon({ view: "collection", panelOpen: false }, "history"),
    ).toEqual({ view: "history", panelOpen: true });
  });

  it("switches from collection to environment and opens", () => {
    expect(clickActivityIcon(openCollection, "environment")).toEqual({
      view: "environment",
      panelOpen: true,
    });
  });

  it("collapses environment when clicking the active icon", () => {
    expect(
      clickActivityIcon({ view: "environment", panelOpen: true }, "environment"),
    ).toEqual({ view: "environment", panelOpen: false });
  });
});

describe("togglePanel", () => {
  it("only toggles open, not the view", () => {
    expect(togglePanel(openCollection)).toEqual({
      view: "collection",
      panelOpen: false,
    });
    expect(togglePanel({ view: "history", panelOpen: false })).toEqual({
      view: "history",
      panelOpen: true,
    });
  });

  it("toggles environment panel without changing view", () => {
    expect(
      togglePanel({ view: "environment", panelOpen: true }),
    ).toEqual({ view: "environment", panelOpen: false });
  });
});
