import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";
import EnvEditor from "./EnvEditor";
import Sidebar from "./Sidebar";

describe("override panel", () => {
  it("renders an override activity button", () => {
    const html = renderToStaticMarkup(
      <ActivityBar
        view="override"
        panelOpen
        onClickIcon={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="覆盖"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders override names and marks the active send override", () => {
    const html = renderToStaticMarkup(
      <Sidebar
        requests={[]}
        currentPath={null}
        view="override"
        sending={false}
        envs={[]}
        editingEnv={null}
        activeEnv=""
        overrides={[
          { name: "default", variables: {} },
          { name: "debug", variables: {} },
        ]}
        editingOverride="debug"
        activeOverride="default"
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
      />,
    );

    expect(html).toContain("default");
    expect(html).toContain("debug");
    expect(html).toContain("发送");
  });

  it("accepts an override-specific empty title", () => {
    const html = renderToStaticMarkup(
      <EnvEditor
        name={null}
        pairs={[]}
        dirty={false}
        saving={false}
        error={null}
        emptyTitle="在左侧选择一套覆盖，或新建"
        onPairsChange={vi.fn()}
        onSave={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    expect(html).toContain("在左侧选择一套覆盖，或新建");
  });
});
