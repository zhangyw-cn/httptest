import { useEffect, useState } from "react";
import { listHistory } from "./api";
import type { HistoryEntry, RequestMeta } from "./types";

interface Props {
  requests: RequestMeta[];
  currentPath: string | null;
  tabLeft: "collection" | "history";
  sending: boolean;
  onTabLeft: (tab: "collection" | "history") => void;
  onSelectRequest: (path: string) => void;
  onNewRequest: () => void;
  onSelectHistory: (entry: HistoryEntry) => void;
}

export default function Sidebar({
  requests,
  currentPath,
  tabLeft,
  sending,
  onTabLeft,
  onSelectRequest,
  onNewRequest,
  onSelectHistory,
}: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [histError, setHistError] = useState<string | null>(null);

  useEffect(() => {
    if (tabLeft !== "history") return;
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
  }, [tabLeft, sending]);

  return (
    <aside className="sidebar">
      <div className="tabs">
        <button
          type="button"
          className={tabLeft === "collection" ? "tab active" : "tab"}
          onClick={() => onTabLeft("collection")}
        >
          集合
        </button>
        <button
          type="button"
          className={tabLeft === "history" ? "tab active" : "tab"}
          onClick={() => onTabLeft("history")}
        >
          历史
        </button>
      </div>
      {tabLeft === "collection" ? (
        <div className="sidebar-body">
          <button type="button" className="btn btn-block" onClick={onNewRequest}>
            新建
          </button>
          <ul className="req-list">
            {requests.map((r) => (
              <li key={r.path}>
                <button
                  type="button"
                  className={
                    currentPath === r.path ? "req-item active" : "req-item"
                  }
                  onClick={() => onSelectRequest(r.path)}
                >
                  <span className="req-path">{r.path}</span>
                  {r.name ? <span className="req-name">{r.name}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="sidebar-body">
          {histError && <p className="error">{histError}</p>}
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
        </div>
      )}
    </aside>
  );
}
