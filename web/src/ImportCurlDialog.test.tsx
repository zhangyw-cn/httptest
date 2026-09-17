import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ImportCurlDialog from "./ImportCurlDialog";

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
