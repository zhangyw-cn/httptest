import { describe, expect, it } from "vitest";
import {
  applyTheme,
  parseThemePref,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from "./theme";

describe("parseThemePref", () => {
  it("returns dark when missing or invalid", () => {
    expect(parseThemePref(null)).toBe("dark");
    expect(parseThemePref("")).toBe("dark");
    expect(parseThemePref("nope")).toBe("dark");
  });

  it("accepts light dark system", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("system")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("uses system preference only when pref is system", () => {
    expect(resolveTheme("system", "light")).toBe("light");
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });
});

describe("readStoredTheme", () => {
  it("returns dark when getter throws", () => {
    expect(
      readStoredTheme(() => {
        throw new Error("blocked");
      }),
    ).toBe("dark");
  });

  it("parses stored value", () => {
    expect(readStoredTheme(() => "system")).toBe("system");
  });
});

describe("writeStoredTheme", () => {
  it("swallows setter errors", () => {
    expect(() =>
      writeStoredTheme("light", () => {
        throw new Error("quota");
      }),
    ).not.toThrow();
  });
});

describe("applyTheme", () => {
  it("sets data-theme on the root element", () => {
    const attrs: Record<string, string> = {};
    const el = {
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
      removeAttribute(name: string) {
        delete attrs[name];
      },
    };
    applyTheme("dark", el as unknown as HTMLElement);
    expect(attrs["data-theme"]).toBe("dark");
    expect(attrs["data-resolved-theme"]).toBeUndefined();
  });
});
