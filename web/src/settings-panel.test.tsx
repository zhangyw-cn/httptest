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
    const settingsBtn = markup.match(
      /<button[^>]*aria-label="设置"[^>]*>|<button[^>]*aria-pressed="true"[^>]*aria-label="设置"[^>]*>/,
    );
    expect(settingsBtn?.[0] ?? "").toContain('aria-pressed="true"');
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
    expect(markup).toContain('class="req-item active"');
  });
});

describe("SettingsPane", () => {
  it("renders theme radiogroup for appearance", () => {
    const markup = renderToStaticMarkup(
      <SettingsPane
        category="appearance"
        theme="dark"
        onThemeChange={vi.fn()}
      />,
    );
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-label="主题"');
    expect(markup).toContain("浅色");
    expect(markup).toContain("深色");
    expect(markup).toContain("系统");
    expect(markup).toContain('role="radio"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup.match(/role="radio"/g)?.length).toBe(3);
    // dark is selected
    expect(markup).toMatch(/aria-checked="true"[^>]*>深色<|>深色<\/button>/);
  });
});
