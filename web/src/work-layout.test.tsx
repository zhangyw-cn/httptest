import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SettingsPane from "./SettingsPane";
import SettingsSidebar from "./SettingsSidebar";
import UrlBar from "./UrlBar";
import { defaultDraft } from "./request";
import { workMode } from "./work-layout";

/** Mirrors App.tsx sidebar + work branching for settings vs request. */
function renderWorkbench(view: "settings" | "collection", panelOpen: boolean) {
  const mode = workMode(view);
  return renderToStaticMarkup(
    <div className="main">
      {panelOpen &&
        (mode === "settings" ? (
          <SettingsSidebar category="appearance" onSelect={vi.fn()} />
        ) : (
          <aside className="sidebar" aria-label="集合侧栏占位" />
        ))}
      <div className="work">
        {mode === "settings" ? (
          <SettingsPane
            category="appearance"
            theme="dark"
            onThemeChange={vi.fn()}
          />
        ) : (
          <UrlBar
            draft={defaultDraft()}
            dirty={false}
            sending={false}
            saving={false}
            onChange={vi.fn()}
            onSend={vi.fn()}
            onStop={vi.fn()}
            onSave={vi.fn()}
            onImportCurl={vi.fn()}
            onExportCurl={vi.fn()}
          />
        )}
      </div>
    </div>,
  );
}

describe("settings workbench layout contract", () => {
  it("hides UrlBar / Send when mode is settings", () => {
    const markup = renderWorkbench("settings", true);
    expect(markup).toContain('aria-label="设置分类"');
    expect(markup).toContain("外观");
    expect(markup).toContain('role="radiogroup"');
    expect(markup).not.toContain(">Send<");
    expect(markup).not.toContain("Method");
  });

  it("keeps settings form when category tree is collapsed", () => {
    const markup = renderWorkbench("settings", false);
    expect(markup).not.toContain('aria-label="设置分类"');
    expect(markup).toContain("外观");
    expect(markup).not.toContain(">Send<");
  });

  it("shows Send in request mode", () => {
    const markup = renderWorkbench("collection", true);
    expect(markup).toContain(">Send<");
    expect(markup).not.toContain('aria-label="设置分类"');
  });
});
