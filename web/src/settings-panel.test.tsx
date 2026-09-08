import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";
import SettingsPane from "./SettingsPane";
import SettingsSidebar from "./SettingsSidebar";
import { SETTINGS_CATEGORIES } from "./settings";

describe("settings activity bar", () => {
  it("renders settings gear with aria-label 设置", () => {
    const markup = renderToStaticMarkup(
      <ActivityBar
        view="settings"
        panelOpen={true}
        onClickIcon={vi.fn()}
      />,
    );
    expect(markup).toContain('aria-label="设置"');
    expect(markup).toContain('aria-pressed="true"');
    // 设置出现在覆盖之后
    const overrideAt = markup.indexOf('aria-label="覆盖"');
    const settingsAt = markup.indexOf('aria-label="设置"');
    expect(overrideAt).toBeGreaterThan(-1);
    expect(settingsAt).toBeGreaterThan(overrideAt);
  });
});

describe("settings categories", () => {
  it("exposes only appearance for v1", () => {
    expect(SETTINGS_CATEGORIES.map((c) => c.id)).toEqual(["appearance"]);
    expect(SETTINGS_CATEGORIES[0]?.label).toBe("外观");
  });
});

describe("SettingsSidebar", () => {
  it("marks 外观 as active", () => {
    const markup = renderToStaticMarkup(
      <SettingsSidebar category="appearance" onSelect={vi.fn()} />,
    );
    expect(markup).toContain("外观");
    expect(markup).toContain("active");
  });
});

describe("SettingsPane", () => {
  it("renders theme switch for appearance", () => {
    const markup = renderToStaticMarkup(
      <SettingsPane
        category="appearance"
        theme="dark"
        onThemeChange={vi.fn()}
      />,
    );
    expect(markup).toContain("主题");
    expect(markup).toContain("浅色");
    expect(markup).toContain("深色");
    expect(markup).toContain("系统");
    // SSR 无法点按；用正则确认三个 button 存在
    expect(markup.match(/type="button"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("shows empty state for unknown category", () => {
    const markup = renderToStaticMarkup(
      <SettingsPane
        category="nope"
        theme="dark"
        onThemeChange={vi.fn()}
      />,
    );
    expect(markup).toContain("未知分类");
    expect(markup).not.toContain('aria-label="主题"');
  });
});
