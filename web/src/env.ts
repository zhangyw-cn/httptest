import type { Environment } from "./types";

export interface EnvPair {
  id: number;
  key: string;
  value: string;
}

let pairSeq = 0;
function nextPairId(): number {
  pairSeq += 1;
  return pairSeq;
}

export function newEnvPair(key = "", value = ""): EnvPair {
  return { id: nextPairId(), key, value };
}

export function varsToPairs(vars: Record<string, string>): EnvPair[] {
  const rows = Object.entries(vars).map(([key, value]) =>
    newEnvPair(key, value),
  );
  return rows.length > 0 ? rows : [newEnvPair()];
}

export function pairsToVars(pairs: EnvPair[]): Record<string, string> {
  const out = Object.create(null) as Record<string, string>;
  for (const p of pairs) {
    if (p.key) out[p.key] = p.value;
  }
  return out;
}

export function varsJSON(vars: Record<string, string> | undefined): string {
  const src = vars ?? {};
  const keys = Object.keys(src).sort();
  const ordered = Object.create(null) as Record<string, string>;
  for (const k of keys) {
    ordered[k] = src[k];
  }
  return JSON.stringify(ordered);
}

export function isEnvDirty(pairs: EnvPair[], savedJSON: string): boolean {
  return varsJSON(pairsToVars(pairs)) !== savedJSON;
}

function cleanRel(name: string): string | null {
  const rel = name.trim().replaceAll("\\", "/");
  if (
    !rel ||
    rel.startsWith("/") ||
    /^[A-Za-z]:(?:$|\/)/.test(rel)
  ) {
    return null;
  }

  const segments: string[] = [];
  for (const segment of rel.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") {
        segments.pop();
      } else {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }

  const cleaned = segments.join("/") || ".";
  if (
    cleaned === "." ||
    cleaned === ".." ||
    cleaned.startsWith("../") ||
    cleaned.startsWith("/")
  ) {
    return null;
  }
  if (cleaned.split("/").includes("..")) return null;
  return cleaned;
}

export function envNameError(name: string, existing: string[]): string | null {
  const cleaned = cleanRel(name);
  if (cleaned === null) return name.trim() ? "名称非法" : "名称不能为空";
  if (cleaned.includes("/")) return "名称不能含 /";
  if (existing.includes(cleaned)) return "已有同名环境";
  return null;
}

export function openEnvForEdit(env: Environment): {
  name: string;
  pairs: EnvPair[];
  snapshot: string;
} {
  const variables = env.variables ?? {};
  return {
    name: env.name,
    pairs: varsToPairs(variables),
    snapshot: varsJSON(variables),
  };
}
