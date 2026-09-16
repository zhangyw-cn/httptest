import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import UrlBar from "./UrlBar";
import { defaultDraft } from "./request";

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
});
