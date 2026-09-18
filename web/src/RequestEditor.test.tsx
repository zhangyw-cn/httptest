import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RequestEditor, { applySettingsNumberInput } from "./RequestEditor";
import { defaultDraft } from "./request";

describe("RequestEditor settings tab", () => {
  it("shows 请求设置 tab and disables max when follow off", () => {
    const markup = renderToStaticMarkup(
      <RequestEditor
        draft={{
          ...defaultDraft(),
          settings: { followRedirects: false, maxRedirects: 5 },
        }}
        onChange={vi.fn()}
      />,
    );
    expect(markup).toContain("请求设置");
    expect(markup).toContain("超时 (ms)");
    expect(markup).toContain("跟随重定向");
    expect(markup).toContain("最大重定向次数");
    expect(markup).toContain("跳过 TLS 校验");
    const max = markup.match(/<input[^>]*id="request-max-redirects"[^>]*>/);
    expect(max?.[0] ?? "").toContain("disabled");
  });

  it("enables max redirects when follow is on", () => {
    const markup = renderToStaticMarkup(
      <RequestEditor
        draft={{
          ...defaultDraft(),
          settings: { followRedirects: true, maxRedirects: 5 },
        }}
        onChange={vi.fn()}
      />,
    );
    const max = markup.match(/<input[^>]*id="request-max-redirects"[^>]*>/);
    expect(max?.[0] ?? "").not.toContain("disabled");
  });

  it("empty max redirects deletes the field instead of writing NaN", () => {
    const next = applySettingsNumberInput(
      { timeoutMs: 30000, followRedirects: true, maxRedirects: 5 },
      "maxRedirects",
      "",
    );
    expect(next.maxRedirects).toBeUndefined();
    expect(Number.isNaN(next.maxRedirects)).toBe(false);
  });

  it("empty timeout deletes timeoutMs like max redirects", () => {
    const next = applySettingsNumberInput(
      { timeoutMs: 5000, followRedirects: true, maxRedirects: 10 },
      "timeoutMs",
      "",
    );
    expect(next.timeoutMs).toBeUndefined();
    expect(Number.isNaN(next.timeoutMs)).toBe(false);
  });

  it("shows TLS warning only when insecure is on", () => {
    const on = renderToStaticMarkup(
      <RequestEditor
        draft={{
          ...defaultDraft(),
          settings: { insecureSkipVerify: true },
        }}
        onChange={vi.fn()}
      />,
    );
    expect(on).toContain("仅用于本机调试，勿对生产证书使用");

    const off = renderToStaticMarkup(
      <RequestEditor draft={defaultDraft()} onChange={vi.fn()} />,
    );
    expect(off).not.toContain("仅用于本机调试，勿对生产证书使用");
  });
});
