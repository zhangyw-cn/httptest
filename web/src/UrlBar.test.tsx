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

describe("UrlBar export curl", () => {
  it("renders export menu control", () => {
    const markup = renderToStaticMarkup(
      <UrlBar
        draft={defaultDraft()}
        dirty={false}
        sending={false}
        saving={false}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        onSave={vi.fn()}
        onExportCurl={vi.fn()}
      />,
    );
    expect(markup).toContain("导出 curl");
  });

  it("disables export while sending", () => {
    const markup = renderToStaticMarkup(
      <UrlBar
        draft={defaultDraft()}
        dirty={false}
        sending={true}
        saving={false}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        onSave={vi.fn()}
        onExportCurl={vi.fn()}
      />,
    );
    expect(markup).toMatch(/导出 curl[\s\S]*disabled|disabled[\s\S]*导出 curl/);
  });

  it("disables export while exporting", () => {
    const markup = renderToStaticMarkup(
      <UrlBar
        draft={defaultDraft()}
        dirty={false}
        sending={false}
        saving={false}
        exporting={true}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        onSave={vi.fn()}
        onExportCurl={vi.fn()}
      />,
    );
    expect(markup).toMatch(/导出 curl[\s\S]*disabled|disabled[\s\S]*导出 curl/);
  });
});
