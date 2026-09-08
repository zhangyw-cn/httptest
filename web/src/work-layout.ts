import type { LeftView } from "./activity";

export type WorkMode = "settings" | "environment" | "override" | "request";

export function workMode(view: LeftView): WorkMode {
  switch (view) {
    case "settings":
      return "settings";
    case "environment":
      return "environment";
    case "override":
      return "override";
    case "collection":
    case "history":
      return "request";
  }
}
