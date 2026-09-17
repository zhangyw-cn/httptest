import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ImportCurlDialog, { tryApplyImport } from "./ImportCurlDialog";

describe("ImportCurlDialog", () => {
  it("renders title, textarea, apply and cancel", () => {
    const markup = renderToStaticMarkup(
      <ImportCurlDialog onApply={vi.fn()} onClose={vi.fn()} />,
    );
    expect(markup).toContain("导入 curl");
    expect(markup).toContain("应用");
    expect(markup).toContain("取消");
    expect(markup).toContain("<textarea");
  });
});

describe("tryApplyImport", () => {
  it("returns error for invalid curl without applying", () => {
    const r = tryApplyImport("not curl");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(0);
  });

  it("returns parsed request for valid curl", () => {
    const r = tryApplyImport("curl 'http://example.com/api'");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.method).toBe("GET");
    expect(r.request.url).toBe("http://example.com/api");
  });
});
