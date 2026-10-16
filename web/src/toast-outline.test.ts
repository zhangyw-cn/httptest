// Vitest runs these tests in Node. This package has no @types/node, and
// styles.css?raw comes back empty, so the file is read with a suppressed import.
// @ts-expect-error node builtins are available at test runtime
import { readFileSync } from "node:fs";
// @ts-expect-error node builtins are available at test runtime
import { dirname, join } from "node:path";
// @ts-expect-error node builtins are available at test runtime
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(): string {
  return readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "styles.css"),
    "utf8",
  );
}

function rule(selector: string): string {
  const text = source();
  const start = text.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = text.indexOf("{", start);
  const close = text.indexOf("}", open);
  if (open < 0 || close < 0) throw new Error(`missing ${selector}`);
  return text.slice(open + 1, close);
}

function between(start: string, end: string): string {
  const text = source();
  const from = text.indexOf(start);
  if (from < 0) throw new Error(`missing ${start}`);
  const to = text.indexOf(end, from + start.length);
  if (to < 0) throw new Error(`missing ${end}`);
  return text.slice(from, to);
}

describe("toast levels", () => {
  it("paints each kind from theme variables and draws no side bar", () => {
    const text = source();
    expect(text).not.toContain(".toast::before");
    expect(text).not.toContain("toast-hint");

    const toast = rule(".toast");
    expect(toast).toContain("border-radius: 8px");
    expect(toast).toContain("box-shadow: var(--toast-shadow)");
    expect(toast).not.toContain("overflow: hidden");
    expect(toast).not.toContain("position: relative");
    expect(toast).not.toContain("var(--line)");
    expect(toast).not.toContain("var(--surface)");

    expect(rule(".toast-error")).toContain("background: var(--toast-error-bg)");
    expect(rule(".toast-error")).toContain(
      "border: 1px solid var(--toast-error-border)",
    );
    expect(rule(".toast-error")).toContain("color: var(--toast-error-ink)");

    expect(rule(".toast-warning")).toContain(
      "background: var(--toast-warning-bg)",
    );
    expect(rule(".toast-warning")).toContain(
      "border: 1px solid var(--toast-warning-border)",
    );
    expect(rule(".toast-warning")).toContain("color: var(--toast-warning-ink)");

    expect(rule(".toast-info")).toContain("background: var(--toast-info-bg)");
    expect(rule(".toast-info")).toContain(
      "border: 1px solid var(--toast-info-border)",
    );
    expect(rule(".toast-info")).toContain("color: var(--toast-info-ink)");

    const dark = between(":root,", 'html[data-theme="light"]');
    expect(dark).toContain("--toast-shadow: 0 4px 16px rgb(0 0 0 / 28%)");
    expect(dark).toContain("--toast-error-bg: #361e1c");
    expect(dark).toContain("--toast-error-border: #d67166");
    expect(dark).toContain("--toast-error-ink: #f2e2de");
    expect(dark).toContain("--toast-warning-bg: #31281c");
    expect(dark).toContain("--toast-warning-border: #d29d41");
    expect(dark).toContain("--toast-warning-ink: #f0e9db");
    expect(dark).toContain("--toast-info-bg: #1a2d25");
    expect(dark).toContain("--toast-info-border: #47ae7e");
    expect(dark).toContain("--toast-info-ink: #ddeee6");
    expect(dark).not.toContain("#f7eeed");

    const light = between('html[data-theme="light"]', "\n* {");
    expect(light).toContain("--toast-shadow: 0 4px 16px rgb(0 0 0 / 12%)");
    expect(light).toContain("--toast-error-bg: #f7eeed");
    expect(light).toContain("--toast-error-border: #9d2d25");
    expect(light).toContain("--toast-error-ink: #53211d");
    expect(light).toContain("--toast-warning-bg: #f5f0e6");
    expect(light).toContain("--toast-warning-border: #815822");
    expect(light).toContain("--toast-warning-ink: #4a331c");
    expect(light).toContain("--toast-info-bg: #e8f2ed");
    expect(light).toContain("--toast-info-border: #27684a");
    expect(light).toContain("--toast-info-ink: #183a2d");
    expect(light).not.toContain("#361e1c");
  });

  it("throws when the selector is absent", () => {
    expect(() => rule(".not-a-toast")).toThrow("missing .not-a-toast");
  });
});
