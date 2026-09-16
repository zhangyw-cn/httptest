import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ExportCurlDialog from "./ExportCurlDialog";
import {
  defaultCurlOptions,
  effectiveCurlOptions,
  formatCurl,
} from "./curl";

const prepared = {
  name: "",
  method: "GET" as const,
  url: "http://example.com/",
  query: {},
  headers: {},
  body: { type: "none" as const },
};

describe("ExportCurlDialog", () => {
  it("shows feature toggles and curl preview", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={prepared}
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
    expect(markup).toContain("-L");
    expect(markup).toContain("--max-time 30");
  });

  it("disables hosts toggle without resolve", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={prepared}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toContain("当前 Hosts 未命中此主机");
  });

  it("enables hosts option text when resolve provided", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={prepared}
        resolve={{ host: "example.com", port: "80", ip: "127.0.0.1" }}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).not.toContain("当前 Hosts 未命中此主机");
    expect(markup).toContain("--resolve");
  });
});

describe("ExportCurlDialog preview options", () => {
  it("matches dialog effective options for toggle preview", () => {
    const resolve = { host: "h", port: "80", ip: "1.1.1.1" };
    const on = formatCurl({
      prepared,
      resolve,
      timeoutSeconds: 30,
      options: effectiveCurlOptions(
        { ...defaultCurlOptions(), maxTime: false },
        resolve,
      ),
    });
    const offHosts = formatCurl({
      prepared,
      resolve,
      timeoutSeconds: 30,
      options: effectiveCurlOptions(
        { useResolve: false, followRedirects: true, maxTime: false },
        resolve,
      ),
    });
    expect(on).toContain("--resolve");
    expect(offHosts).not.toContain("--resolve");
  });
});
