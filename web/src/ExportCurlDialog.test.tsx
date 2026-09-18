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
    expect(markup).toContain("跳过 TLS 校验");
    expect(markup).toContain("限制最大重定向");
    expect(markup).toContain("默认 30000ms");
    expect(markup).toContain("curl");
    expect(markup).toContain("复制到剪贴板");
    expect(markup).toContain("-L");
    expect(markup).toContain("--max-time 30");
    expect(markup).toContain("--max-redirs 10");
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

  it("does not emit -L when prepared followRedirects is false", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={{ ...prepared, settings: { followRedirects: false } }}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).not.toContain("-L");
  });

	it("emits -k when prepared insecureSkipVerify is true", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={{ ...prepared, settings: { insecureSkipVerify: true } }}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toContain("-k");
  });

  it("disables max-redirs checkbox when follow is off", () => {
    const markup = renderToStaticMarkup(
      <ExportCurlDialog
        prepared={{ ...prepared, settings: { followRedirects: false } }}
        timeoutSeconds={30}
        onClose={vi.fn()}
      />,
    );
    expect(markup).toMatch(/disabled[\s\S]{0,80}限制最大重定向/);
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
        {
          useResolve: false,
          followRedirects: true,
          maxRedirects: false,
          maxTime: false,
          insecure: false,
        },
        resolve,
      ),
    });
    expect(on).toContain("--resolve");
    expect(offHosts).not.toContain("--resolve");
  });
});
