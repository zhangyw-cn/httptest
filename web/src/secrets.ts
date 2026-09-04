export function secretsJSON(
  secrets: Record<string, string> | undefined,
): string {
  const src = secrets ?? {};
  const keys = Object.keys(src).sort();
  const ordered: Record<string, string> = {};
  for (const k of keys) {
    ordered[k] = src[k];
  }
  return JSON.stringify(ordered);
}
