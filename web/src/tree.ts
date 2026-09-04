import type { RequestMeta } from "./types";

export interface TreeNode {
  name: string;
  path?: string;
  children: TreeNode[];
}

export function buildRequestTree(requests: RequestMeta[]): TreeNode[] {
  type Mutable = { name: string; path?: string; children: Map<string, Mutable> };
  const root: Mutable = { name: "", children: new Map() };
  for (const r of requests) {
    const parts = r.path.split("/").filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let next = cur.children.get(part);
      if (!next) {
        next = { name: part, children: new Map() };
        cur.children.set(part, next);
      }
      if (i === parts.length - 1) {
        next.path = r.path;
      }
      cur = next;
    }
  }
  function toList(node: Mutable): TreeNode[] {
    return [...node.children.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({
        name: n.name,
        path: n.path,
        children: toList(n),
      }));
  }
  return toList(root);
}
