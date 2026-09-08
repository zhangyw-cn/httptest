import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";

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
