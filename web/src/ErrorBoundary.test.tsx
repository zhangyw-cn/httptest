import { act } from "react";
import { describe, expect, it } from "vitest";
import ErrorBoundary from "./ErrorBoundary";
import { installDomShim } from "./installDomShim";

function Boom(): React.ReactElement {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders an empty fallback without a banner", async () => {
    installDomShim();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <ErrorBoundary>
            <Boom />
          </ErrorBoundary>,
        );
      });
      const markup = container.innerHTML;
      expect(markup).not.toContain("banner");
      expect(markup).not.toContain("界面出错");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });
});
