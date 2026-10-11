import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import Toaster from "./Toaster";
import { notifyError, notifyHint, resetToastsForTests } from "./toast";

afterEach(() => {
  resetToastsForTests();
});

describe("Toaster", () => {
  it("renders nothing when the queue is empty", () => {
    expect(renderToStaticMarkup(<Toaster />)).toBe("");
  });

  it("renders an error and a hint in a top-center stack with close buttons", () => {
    notifyError("缺少变量：baseUrl");
    notifyHint("已复制");
    const markup = renderToStaticMarkup(<Toaster />);
    expect(markup).toContain('class="toaster"');
    expect(markup.indexOf("已复制")).toBeLessThan(
      markup.indexOf("缺少变量：baseUrl"),
    );
    expect(markup).toContain('class="toast toast-hint"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('class="toast toast-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-label="关闭"');
    expect(markup).not.toContain("banner");
  });
});
