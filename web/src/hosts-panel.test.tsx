import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";
import Dialog from "./Dialog";
import EnvEditor from "./EnvEditor";
import HostsContentEditor from "./HostsContentEditor";
import Sidebar from "./Sidebar";
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

  it("disables new-hosts controls when list load failed", () => {
    const markup = renderToStaticMarkup(
      <Sidebar
        requests={[]}
        currentPath={null}
        view="hosts"
        sending={false}
        envs={[]}
        editingEnv={null}
        activeEnv=""
        overrides={[]}
        editingOverride={null}
        activeOverride=""
        onSelectRequest={vi.fn()}
        onNewRequest={vi.fn()}
        onDeleteRequest={vi.fn()}
        onSelectHistory={vi.fn()}
        onSelectEnv={vi.fn()}
        onNewEnv={vi.fn()}
        onDeleteEnv={vi.fn()}
        onSelectOverride={vi.fn()}
        onNewOverride={vi.fn()}
        onDeleteOverride={vi.fn()}
        hostsList={[]}
        editingHosts={null}
        activeHosts=""
        onSelectHosts={vi.fn()}
        onNewHosts={vi.fn()}
        onDeleteHosts={vi.fn()}
        hostsListError="无法加载 Hosts 列表"
      />,
    );
    expect(markup).toContain("Hosts 列表加载失败");
    expect(markup).toContain("无法加载 Hosts 列表");
    expect(markup).toContain('disabled=""');
  });

  it("shows create-hosts type picker with default map", () => {
    const markup = renderToStaticMarkup(
      <Dialog
        mode={{
          kind: "path",
          title: "新建 Hosts",
          submitLabel: "创建",
          error: null,
          intent: "create-hosts",
          hint: "名称，例如 lan",
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(markup).toContain("hosts-type-pick");
    expect(markup).toContain("map（键值）");
    expect(markup).toContain("hosts（文本）");
    expect(markup).toContain('value="map"');
    expect(markup).toContain("checked");
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
