// Vitest runs these tests in Node. This package has no @types/node, and
// styles.css?raw comes back empty, so the file is read with a suppressed import.
// @ts-expect-error node builtins are available at test runtime
import { readFileSync } from "node:fs";
// @ts-expect-error node builtins are available at test runtime
import { dirname, join } from "node:path";
// @ts-expect-error node builtins are available at test runtime
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function rule(selector: string): string {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "styles.css"),
    "utf8",
  );
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  if (open < 0 || close < 0) throw new Error(`missing ${selector}`);
  return source.slice(open + 1, close);
}

describe("toast outline", () => {
  it("draws a rounded line and a 3px kind bar inside it", () => {
    const toast = rule(".toast");
    expect(toast).toContain("border: 1px solid var(--line)");
    expect(toast).toContain("border-radius: 8px");
    expect(toast).toContain("overflow: hidden");
    expect(toast).not.toContain("border: none");

    const bar = rule(".toast::before");
    expect(bar).toContain("width: 3px");
    expect(bar).toContain("position: absolute");
    expect(bar).toContain("left: 0");
    expect(bar).toContain("top: 0");
    expect(bar).toContain("bottom: 0");

    expect(rule(".toast-error::before")).toContain("background: var(--err)");
    expect(rule(".toast-hint::before")).toContain("background: var(--accent)");
    expect(rule(".toast-error")).toContain("color: var(--err)");
    expect(rule(".toast-hint")).toContain("color: var(--ink)");
  });

  it("throws when the selector is absent", () => {
    expect(() => rule(".not-a-toast")).toThrow("missing .not-a-toast");
  });
});
