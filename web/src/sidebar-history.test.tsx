import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";
import { installDomShim, uninstallDomShim } from "../test/installDomShim";
import { getToasts, resetToastsForTests } from "./toast";
import type { HistoryEntry } from "./types";

const listHistory = vi.hoisted(() => vi.fn());

vi.mock("./api", () => ({
  listHistory,
}));

afterEach(() => {
  resetToastsForTests();
  uninstallDomShim();
  listHistory.mockReset();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function historySidebar(sending: boolean) {
  return (
    <Sidebar
      requests={[]}
      currentPath={null}
      view="history"
      sending={sending}
      envs={[]}
      editingEnv={null}
      activeEnv=""
      overrides={[]}
      editingOverride={null}
      activeOverride=""
      onSelectRequest={vi.fn()}
      onNewRequest={vi.fn()}
      onDeleteRequest={vi.fn()}
      onSelectHistory={vi.fn()}
      onSelectEnv={vi.fn()}
      onNewEnv={vi.fn()}
      onDeleteEnv={vi.fn()}
      onSelectOverride={vi.fn()}
      onNewOverride={vi.fn()}
      onDeleteOverride={vi.fn()}
      hostsList={[]}
      editingHosts={null}
      activeHosts=""
      onSelectHosts={vi.fn()}
      onNewHosts={vi.fn()}
      onDeleteHosts={vi.fn()}
    />
  );
}

const kept = {
  id: "h1",
  time: "12:00",
  request: { method: "GET", url: "https://example.test/keep" },
} as HistoryEntry;

describe("history list load", () => {
  it("keeps the loaded list when a later load fails", async () => {
    installDomShim();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const first = deferred<HistoryEntry[]>();
    listHistory.mockReturnValueOnce(first.promise);
    try {
      await act(async () => {
        root.render(historySidebar(false));
      });
      await act(async () => {
        first.resolve([kept]);
      });
      expect(container.textContent).toContain("https://example.test/keep");

      const second = deferred<HistoryEntry[]>();
      listHistory.mockReturnValueOnce(second.promise);
      await act(async () => {
        root.render(historySidebar(true));
      });
      await act(async () => {
        second.reject(new Error("history down"));
      });
      expect(container.textContent).toContain("https://example.test/keep");
      expect(container.textContent).not.toContain("还没有历史");
      expect(getToasts().map((item) => item.message)).toContain("history down");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });

  it("shows the empty copy when the first load fails", async () => {
    installDomShim();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const first = deferred<HistoryEntry[]>();
    listHistory.mockReturnValueOnce(first.promise);
    try {
      await act(async () => {
        root.render(historySidebar(false));
      });
      await act(async () => {
        first.reject(new Error("history down"));
      });
      expect(container.textContent).toContain("还没有历史");
      expect(container.textContent).toContain("发送成功的请求会列在这里");
      expect(getToasts().map((item) => item.message)).toContain("history down");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });
});
