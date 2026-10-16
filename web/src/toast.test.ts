import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismiss,
  getToasts,
  notifyError,
  notifyInfo,
  notifySticky,
  notifyWarning,
  noticesForResult,
  pause,
  publishResultNotices,
  resetToastsForTests,
  resume,
} from "./toast";

beforeEach(() => {
  vi.useFakeTimers();
  resetToastsForTests();
});

afterEach(() => {
  resetToastsForTests();
  vi.useRealTimers();
});

describe("toast queue", () => {
  it("returns the same snapshot until the queue changes", () => {
    const first = getToasts();
    expect(getToasts()).toBe(first);
    notifyError("缺少变量：baseUrl");
    const afterNotify = getToasts();
    expect(afterNotify).not.toBe(first);
    expect(getToasts()).toBe(afterNotify);
  });

  it("drops empty messages", () => {
    notifyError("");
    notifyInfo("");
    notifyWarning("");
    notifySticky("");
    expect(getToasts()).toEqual([]);
  });

  it("removes an error after 8000ms and an info after 3000ms", () => {
    notifyError("保存失败");
    notifyInfo("已复制");
    expect(getToasts().map((t) => t.message)).toEqual(["已复制", "保存失败"]);
    vi.advanceTimersByTime(3000);
    expect(getToasts().map((t) => t.message)).toEqual(["保存失败"]);
    vi.advanceTimersByTime(5000);
    expect(getToasts()).toEqual([]);
  });

  it("removes a warning after 5000ms and keeps the error", () => {
    notifyError("保存失败");
    notifyWarning("请等待 Hosts 保存完成");
    vi.advanceTimersByTime(5000);
    expect(getToasts().map((t) => t.message)).toEqual(["保存失败"]);
    vi.advanceTimersByTime(3000);
    expect(getToasts()).toEqual([]);
  });

  it("keeps an error and a warning that share a message", () => {
    notifyError("保存失败");
    notifyWarning("保存失败");
    expect(getToasts().map((t) => [t.kind, t.message])).toEqual([
      ["warning", "保存失败"],
      ["error", "保存失败"],
    ]);
  });

  it("resets the full duration when the same timed message is enqueued again", () => {
    notifyError("保存失败");
    const id = getToasts()[0].id;
    vi.advanceTimersByTime(7000);
    notifyError("保存失败");
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].id).toBe(id);
    vi.advanceTimersByTime(7000);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(getToasts()).toEqual([]);
  });

  it("dismisses only the chosen toast", () => {
    notifyError("a");
    notifyError("b");
    dismiss(getToasts()[1].id);
    expect(getToasts().map((t) => t.message)).toEqual(["b"]);
  });

  it("keeps a sticky toast until dismiss and ignores a duplicate", () => {
    notifySticky("界面出错：boom");
    vi.advanceTimersByTime(60_000);
    expect(getToasts()).toHaveLength(1);
    notifySticky("界面出错：boom");
    expect(getToasts()).toHaveLength(1);
    dismiss(getToasts()[0].id);
    expect(getToasts()).toEqual([]);
  });

  it("pauses the remaining time and resumes it", () => {
    notifyError("保存失败");
    const id = getToasts()[0].id;
    vi.advanceTimersByTime(3000);
    pause(id);
    vi.advanceTimersByTime(10_000);
    expect(getToasts()).toHaveLength(1);
    resume(id);
    vi.advanceTimersByTime(4999);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toEqual([]);
  });
});

describe("noticesForResult", () => {
  it("prefers the missing-vars sentence over errorMessage", () => {
    expect(
      noticesForResult({
        errorClass: "invalid",
        errorMessage: "missing baseUrl",
        missingVars: ["baseUrl"],
      }),
    ).toEqual(["缺少变量：baseUrl"]);
  });

  it("joins several missing names with a comma", () => {
    expect(
      noticesForResult({
        errorClass: "invalid",
        errorMessage: "",
        missingVars: ["baseUrl", "token"],
      }),
    ).toEqual(["缺少变量：baseUrl, token"]);
  });

  it("formats class and message", () => {
    expect(
      noticesForResult({
        errorClass: "dns",
        errorMessage: "connection refused",
      }),
    ).toEqual(["dns：connection refused"]);
  });

  it("uses the message alone when class is empty", () => {
    expect(
      noticesForResult({ errorClass: "", errorMessage: "boom" }),
    ).toEqual(["boom"]);
  });

  it("uses the class alone when there is no message and the class is not http", () => {
    expect(
      noticesForResult({ errorClass: "timeout", errorMessage: "" }),
    ).toEqual(["timeout"]);
  });

  it("does not toast a bare http status", () => {
    expect(
      noticesForResult({ errorClass: "http", errorMessage: "" }),
    ).toEqual([]);
  });

  it("formats an http errorMessage with the class prefix", () => {
    expect(
      noticesForResult({
        errorClass: "http",
        errorMessage: "redirect limit reached (10)",
      }),
    ).toEqual(["http：redirect limit reached (10)"]);
  });

  it("places historyError after the primary sentence", () => {
    expect(
      noticesForResult({
        errorClass: "dns",
        errorMessage: "connection refused",
        historyError: "disk full",
      }),
    ).toEqual([
      "dns：connection refused",
      "历史记录未写入：disk full",
    ]);
  });

  it("publishes history first so the primary sentence stays on top", () => {
    publishResultNotices({
      errorClass: "dns",
      errorMessage: "connection refused",
      historyError: "disk full",
    });
    expect(getToasts().map((t) => t.message)).toEqual([
      "dns：connection refused",
      "历史记录未写入：disk full",
    ]);
  });
});
