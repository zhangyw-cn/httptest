import { useEffect, useState } from "react";
import { listHistory } from "./api";
import { buildRequestTree, type TreeNode } from "./tree";
import type { LeftView } from "./activity";
import type { HistoryEntry, RequestMeta } from "./types";

interface Props {
  requests: RequestMeta[];
  currentPath: string | null;
  view: LeftView;
  sending: boolean;
  onSelectRequest: (path: string) => void;
  onNewRequest: () => void;
  onDeleteRequest: (path: string) => void;
  onSelectHistory: (entry: HistoryEntry) => void;
}

function TreeItems({
  nodes,
  depth,
  currentPath,
  onSelectRequest,
  onDeleteRequest,
}: {
  nodes: TreeNode[];
  depth: number;
  currentPath: string | null;
  onSelectRequest: (path: string) => void;
  onDeleteRequest: (path: string) => void;
}) {
  return (
    <ul className="req-list" style={{ paddingLeft: depth ? "0.75rem" : 0 }}>
      {nodes.map((n) => (
        <li key={n.path ?? `dir:${n.name}:${depth}`}>
          {n.path ? (
            <div className="tree-row">
              <button
                type="button"
                className={
                  currentPath === n.path ? "req-item active" : "req-item"
                }
                onClick={() => onSelectRequest(n.path!)}
              >
                <span className="req-path">{n.name}</span>
              </button>
              <button
                type="button"
                className="btn-icon"
                title="删除"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRequest(n.path!);
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="tree-folder">{n.name}</div>
          )}
          {n.children.length > 0 ? (
            <TreeItems
              nodes={n.children}
              depth={depth + 1}
              currentPath={currentPath}
              onSelectRequest={onSelectRequest}
              onDeleteRequest={onDeleteRequest}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function Sidebar({
  requests,
  currentPath,
  view,
  sending,
  onSelectRequest,
  onNewRequest,
  onDeleteRequest,
  onSelectHistory,
}: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [histError, setHistError] = useState<string | null>(null);
  const tree = buildRequestTree(requests);

  useEffect(() => {
    if (view !== "history") return;
    let cancelled = false;
    (async () => {
      try {
        const items = await listHistory();
        if (!cancelled) {
          setHistory(items);
          setHistError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setHistError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, sending]);

  if (view === "collection") {
    return (
      <aside className="sidebar">
        <div className="sidebar-head">
          集合
          <button
            type="button"
            className="btn-icon"
            title="新建"
            onClick={onNewRequest}
          >
            ＋
          </button>
        </div>
        <div className="sidebar-body">
          {requests.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">还没有请求</p>
              <p className="empty-hint">用标题栏 ＋ 或下方按钮创建</p>
              <button type="button" className="btn" onClick={onNewRequest}>
                新建请求
              </button>
            </div>
          ) : (
            <TreeItems
              nodes={tree}
              depth={0}
              currentPath={currentPath}
              onSelectRequest={onSelectRequest}
              onDeleteRequest={onDeleteRequest}
            />
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">历史</div>
      <div className="sidebar-body">
        {histError && <p className="error">{histError}</p>}
        {history.length === 0 && !histError ? (
          <div className="empty-state">
            <p className="empty-title">还没有历史</p>
            <p className="empty-hint">发送成功的请求会列在这里</p>
          </div>
        ) : (
          <ul className="req-list">
            {history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="req-item"
                  onClick={() => onSelectHistory(h)}
                >
                  <span className="req-path">
                    {h.request.method} {h.request.url}
                  </span>
                  <span className="req-name">
                    {h.time}
                    {h.requestPath ? ` · ${h.requestPath}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
