import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ExportCurlDialog from "./ExportCurlDialog";

describe("ExportCurlDialog", () => {
  it("shows feature toggles and curl preview", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={{
          name: "",
          method: "GET",
          url: "http://example.com/",
          query: {},
          headers: {},
          body: { type: "none" },
        }}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toContain("导出 curl");
    expect(markup).toContain("使用当前 Hosts 解析");
    expect(markup).toContain("跟随重定向");
    expect(markup).toContain("限制超时");
    expect(markup).toContain("curl");
    expect(markup).toContain("复制到剪贴板");
  });

  it("disables hosts toggle without resolve", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={{
          name: "",
          method: "GET",
          url: "http://example.com/",
          query: {},
          headers: {},
          body: { type: "none" },
        }}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toContain("当前 Hosts 未命中此主机");
  });
});
