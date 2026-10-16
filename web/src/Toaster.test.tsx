import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import Toaster from "./Toaster";
import { installDomShim } from "./installDomShim";
import { notifyError, notifyInfo, notifyWarning, resetToastsForTests } from "./toast";

afterEach(() => {
  resetToastsForTests();
});

describe("Toaster", () => {
  it("renders nothing when the queue is empty", () => {
    expect(renderToStaticMarkup(<Toaster />)).toBe("");
  });

  it("mounts on the client and shows a notified error", async () => {
    installDomShim();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => {
        root.render(<Toaster />);
      });
      act(() => {
        notifyError("缺少变量：baseUrl");
      });
      expect(container.textContent).toContain("缺少变量：baseUrl");
    } finally {
      act(() => {
        root.unmount();
      });
    }
  });

  it("renders an error, a warning, and an info in a top-center stack", () => {
    notifyError("缺少变量：baseUrl");
    notifyWarning("请等待 Hosts 保存完成");
    notifyInfo("已复制");
    const markup = renderToStaticMarkup(<Toaster />);
    expect(markup).toContain('class="toaster"');
    expect(markup.indexOf("已复制")).toBeLessThan(
      markup.indexOf("请等待 Hosts 保存完成"),
    );
    expect(markup.indexOf("请等待 Hosts 保存完成")).toBeLessThan(
      markup.indexOf("缺少变量：baseUrl"),
    );
    expect(markup).toContain('class="toast toast-info"');
    expect(markup).toContain('class="toast toast-warning"');
    expect(markup).toContain('class="toast toast-error"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-label="关闭"');
    expect(markup).not.toContain("toast-hint");
    expect(markup).not.toContain("banner");
  });
});
