import { useEffect, useState } from "react";
import { listHistory } from "./api";
import { buildRequestTree, type TreeNode } from "./tree";
import type { LeftView } from "./activity";
import { hostsRowStates } from "./hosts";
import { overrideRowStates } from "./override";
import type {
  Environment,
  HistoryEntry,
  HostsFile,
  Override,
  RequestMeta,
} from "./types";

interface Props {
  requests: RequestMeta[];
  currentPath: string | null;
  view: Exclude<LeftView, "settings">;
  sending: boolean;
  envs: Environment[];
  editingEnv: string | null;
  activeEnv: string;
  overrides: Override[];
  editingOverride: string | null;
  activeOverride: string;
  onSelectRequest: (path: string) => void;
  onNewRequest: () => void;
  onDeleteRequest: (path: string) => void;
  onSelectHistory: (entry: HistoryEntry) => void;
  onSelectEnv: (name: string) => void;
  onNewEnv: () => void;
  onDeleteEnv: (name: string) => void;
  onSelectOverride: (name: string) => void;
  onNewOverride: () => void;
  onDeleteOverride: (name: string) => void;
  hostsList: HostsFile[];
  editingHosts: string | null;
  activeHosts: string;
  onSelectHosts: (name: string) => void;
  onNewHosts: () => void;
  onDeleteHosts: (name: string) => void;
  envBusy?: boolean;
  overrideBusy?: boolean;
  hostsBusy?: boolean;
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
  envs,
  editingEnv,
  activeEnv,
  overrides,
  editingOverride,
  activeOverride,
  onSelectRequest,
  onNewRequest,
  onDeleteRequest,
  onSelectHistory,
  onSelectEnv,
  onNewEnv,
  onDeleteEnv,
  onSelectOverride,
  onNewOverride,
  onDeleteOverride,
  hostsList,
  editingHosts,
  activeHosts,
  onSelectHosts,
  onNewHosts,
  onDeleteHosts,
  envBusy = false,
  overrideBusy = false,
  hostsBusy = false,
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

  if (view === "environment") {
    return (
      <aside className="sidebar">
        <div className="sidebar-head">
          环境
          <button
            type="button"
            className="btn-icon"
            title="新建"
            onClick={onNewEnv}
            disabled={envBusy}
          >
            ＋
          </button>
        </div>
        <div className="sidebar-body">
          {envs.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">还没有环境</p>
              <p className="empty-hint">用标题栏 ＋ 或下方按钮创建</p>
              <button
                type="button"
                className="btn"
                onClick={onNewEnv}
                disabled={envBusy}
              >
                新建环境
              </button>
            </div>
          ) : (
            <ul className="req-list">
              {envs.map((env) => (
                <li key={env.name}>
                  <div className="tree-row">
                    <button
                      type="button"
                      className={
                        editingEnv === env.name ? "req-item active" : "req-item"
                      }
                      onClick={() => onSelectEnv(env.name)}
                    >
                      <span className="req-path">{env.name}</span>
                      {activeEnv === env.name ? (
                        <span className="env-send-badge">发送</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title="删除"
                      disabled={envBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEnv(env.name);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    );
  }

  if (view === "hosts") {
    return (
      <aside className="sidebar">
        <div className="sidebar-head">
          Hosts
          <button
            type="button"
            className="btn-icon"
            title="新建"
            onClick={onNewHosts}
            disabled={hostsBusy}
          >
            ＋
          </button>
        </div>
        <div className="sidebar-body">
          {hostsList.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">还没有 Hosts</p>
              <p className="empty-hint">用标题栏 ＋ 或下方按钮创建</p>
              <button
                type="button"
                className="btn"
                onClick={onNewHosts}
                disabled={hostsBusy}
              >
                新建 Hosts
              </button>
            </div>
          ) : (
            <ul className="req-list">
              {hostsRowStates(
                hostsList.map((item) => item.name),
                activeHosts,
                editingHosts,
              ).map((row) => (
                <li key={row.name}>
                  <div className="tree-row">
                    <button
                      type="button"
                      className={row.itemClassName}
                      onClick={() => onSelectHosts(row.name)}
                    >
                      <span className="req-path">{row.name}</span>
                      {row.showSendBadge ? (
                        <span className="env-send-badge">发送</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title="删除"
                      disabled={hostsBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteHosts(row.name);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    );
  }

  if (view === "override") {
    return (
      <aside className="sidebar">
        <div className="sidebar-head">
          覆盖
          <button
            type="button"
            className="btn-icon"
            title="新建"
            onClick={onNewOverride}
            disabled={overrideBusy}
          >
            ＋
          </button>
        </div>
        <div className="sidebar-body">
          {overrides.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">还没有覆盖</p>
              <p className="empty-hint">用标题栏 ＋ 或下方按钮创建</p>
              <button
                type="button"
                className="btn"
                onClick={onNewOverride}
                disabled={overrideBusy}
              >
                新建覆盖
              </button>
            </div>
          ) : (
            <ul className="req-list">
              {overrideRowStates(
                overrides.map((override) => override.name),
                activeOverride,
                editingOverride,
              ).map((row) => (
                <li key={row.name}>
                  <div className="tree-row">
                    <button
                      type="button"
                      className={row.itemClassName}
                      onClick={() => onSelectOverride(row.name)}
                    >
                      <span className="req-path">{row.name}</span>
                      {row.showSendBadge ? (
                        <span className="env-send-badge">发送</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      title="删除"
                      disabled={overrideBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteOverride(row.name);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
