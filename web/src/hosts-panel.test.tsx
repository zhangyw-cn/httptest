import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";
import { hostsRowStates } from "./hosts";

describe("hosts activity", () => {
  it("renders Hosts among top icons", () => {
    const markup = renderToStaticMarkup(
      <ActivityBar view="hosts" panelOpen={true} onClickIcon={vi.fn()} />,
    );
    expect(markup).toContain('aria-label="Hosts"');
    expect(markup).toContain('aria-pressed="true"');
  });

  it("puts the send badge only on activeHosts, not editingHosts", () => {
    expect(hostsRowStates(["lan", "lab"], "lan", "lab")).toEqual([
      { name: "lan", itemClassName: "req-item", showSendBadge: true },
      { name: "lab", itemClassName: "req-item active", showSendBadge: false },
    ]);
  });
});
