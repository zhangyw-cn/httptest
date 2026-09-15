import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";
import EnvEditor from "./EnvEditor";
import HostsContentEditor from "./HostsContentEditor";
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

  it("shows list load error in EnvEditor empty state", () => {
    const markup = renderToStaticMarkup(
      <EnvEditor
        name={null}
        pairs={[]}
        dirty={false}
        saving={false}
        error="无法加载 Hosts 列表"
        onPairsChange={vi.fn()}
        onSave={vi.fn()}
        onRename={vi.fn()}
        emptyTitle="在左侧选择一套 Hosts，或新建"
      />,
    );
    expect(markup).toContain("无法加载 Hosts 列表");
    expect(markup).toContain("env-editor-error");
  });

  it("shows list load error in HostsContentEditor empty state", () => {
    const markup = renderToStaticMarkup(
      <HostsContentEditor
        name={null}
        hostsType="hosts"
        content=""
        dirty={false}
        saving={false}
        error="无法加载 Hosts 列表"
        emptyTitle="在左侧选择一套 Hosts，或新建"
        onContentChange={vi.fn()}
        onSave={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(markup).toContain("无法加载 Hosts 列表");
    expect(markup).toContain("env-editor-error");
  });
});
