export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "httptest.theme";

export function parseThemePref(raw: string | null): ThemePref {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "dark";
}

export function resolveTheme(
  pref: ThemePref,
  system: "light" | "dark",
): "light" | "dark" {
  return pref === "system" ? system : pref;
}

export function readStoredTheme(
  getItem: () => string | null = () => localStorage.getItem(THEME_KEY),
): ThemePref {
  try {
    return parseThemePref(getItem());
  } catch {
    return "dark";
  }
}

export function writeStoredTheme(
  pref: ThemePref,
  setItem: (value: string) => void = (value) =>
    localStorage.setItem(THEME_KEY, value),
): void {
  try {
    setItem(pref);
  } catch {
    // 本机工具：存储失败则仅本次会话有效
  }
}

let systemMediaCleanup: (() => void) | null = null;

export function applyTheme(
  pref: ThemePref,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute("data-theme", pref);

  // Clean up previous listener
  if (systemMediaCleanup) {
    systemMediaCleanup();
    systemMediaCleanup = null;
  }

  if (pref === "system" && typeof window !== "undefined" && window.matchMedia) {
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => {
      root.setAttribute(
        "data-resolved-theme",
        mql.matches ? "light" : "dark",
      );
    };
    update();
    mql.addEventListener("change", update);
    systemMediaCleanup = () => mql.removeEventListener("change", update);
  } else {
    root.removeAttribute("data-resolved-theme");
  }
}
