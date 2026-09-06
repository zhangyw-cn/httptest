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
  const out: Record<string, string> = {};
  for (const p of pairs) {
    if (p.key) out[p.key] = p.value;
  }
  return out;
}

export function varsJSON(vars: Record<string, string> | undefined): string {
  const src = vars ?? {};
  const keys = Object.keys(src).sort();
  const ordered: Record<string, string> = {};
  for (const k of keys) {
    ordered[k] = src[k];
  }
  return JSON.stringify(ordered);
}

export function isEnvDirty(pairs: EnvPair[], savedJSON: string): boolean {
  return varsJSON(pairsToVars(pairs)) !== savedJSON;
}

export function envNameError(name: string, existing: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "名称不能为空";
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return "名称不能含 /";
  }
  if (trimmed.startsWith("..") || trimmed === "." || trimmed === "..") {
    return "名称非法";
  }
  if (existing.includes(trimmed)) return "已有同名环境";
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
