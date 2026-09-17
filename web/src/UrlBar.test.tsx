import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import UrlBar, { sendMenuBusy } from "./UrlBar";
import { defaultDraft } from "./request";

describe("sendMenuBusy", () => {
  it("is busy when sending or exporting", () => {
    expect(sendMenuBusy(false, false)).toBe(false);
    expect(sendMenuBusy(true, false)).toBe(true);
    expect(sendMenuBusy(false, true)).toBe(true);
  });
});

describe("UrlBar more menu", () => {
  const base = {
    draft: defaultDraft(),
    dirty: false,
    sending: false,
    saving: false,
    onChange: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    onSave: vi.fn(),
    onImportCurl: vi.fn(),
    onExportCurl: vi.fn(),
  };

  it("renders overflow control and menu labels", () => {
    const markup = renderToStaticMarkup(<UrlBar {...base} />);
    expect(markup).toContain('aria-label="更多"');
    expect(markup).toContain("导入 curl");
    expect(markup).toContain("导出 curl");
    expect(markup).not.toContain("send-split");
  });

  it("disables more menu while sending", () => {
    const markup = renderToStaticMarkup(<UrlBar {...base} sending={true} />);
    expect(markup).toMatch(/aria-label="更多"[\s\S]*disabled|disabled[\s\S]*aria-label="更多"/);
  });

  it("disables more menu while exporting", () => {
    const markup = renderToStaticMarkup(
      <UrlBar {...base} exporting={true} />,
    );
    expect(markup).toMatch(/aria-label="更多"[\s\S]*disabled|disabled[\s\S]*aria-label="更多"/);
  });
});
