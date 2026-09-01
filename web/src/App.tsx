import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelExecute,
  createRequest,
  execute,
  getEnvironments,
  getLocal,
  getRequest,
  getWorkspace,
  putLocal,
  putRequest,
} from "./api";
import RequestEditor from "./RequestEditor";
import ResponsePane from "./ResponsePane";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type {
  Environment,
  HistoryEntry,
  HttpRequest,
  LocalConfig,
  Result,
  WorkspaceInfo,
} from "./types";

export function defaultDraft(): HttpRequest {
  return {
    name: "",
    method: "GET",
    url: "{{baseUrl}}/",
    query: {},
    headers: {},
    body: { type: "none" },
  };
}

export function normalizeRequest(r: HttpRequest): HttpRequest {
  const next: HttpRequest = {
    name: r.name ?? "",
    method: r.method || "GET",
    url: r.url ?? "",
    query: r.query ?? {},
    headers: r.headers ?? {},
    body: r.body ?? { type: "none" },
  };
  if (r.timeout) next.timeout = r.timeout;
  return next;
}

export function parseHistoryResult(result: unknown): Result {
  if (typeof result === "string") {
    return JSON.parse(result) as Result;
  }
  return result as Result;
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [local, setLocal] = useState<LocalConfig | null>(null);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [draft, setDraft] = useState<HttpRequest>(defaultDraft);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [executeId, setExecuteId] = useState<string | null>(null);
  const [tabLeft, setTabLeft] = useState<"collection" | "history">(
    "collection",
  );
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef(JSON.stringify(defaultDraft()));

  const applyDraft = useCallback((next: HttpRequest, saved?: boolean) => {
    const n = normalizeRequest(next);
    setDraft(n);
    if (saved) {
      savedRef.current = JSON.stringify(n);
      setDirty(false);
    } else {
      setDirty(JSON.stringify(n) !== savedRef.current);
    }
  }, []);

  const reloadWorkspace = useCallback(async () => {
    const ws = await getWorkspace();
    setWorkspace(ws);
    return ws;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ws, loc, environments] = await Promise.all([
          getWorkspace(),
          getLocal(),
          getEnvironments(),
        ]);
        if (cancelled) return;
        setWorkspace(ws);
        setLocal(loc);
        setEnvs(environments);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onEnvChange(environment: string) {
    if (!local) return;
    const next = { ...local, environment };
    const saved = await putLocal(next);
    setLocal(saved);
  }

  async function onSecretsChange(secrets: Record<string, string>) {
    if (!local) return;
    const next = { ...local, secrets };
    const saved = await putLocal(next);
    setLocal(saved);
  }

  async function onSelectRequest(path: string) {
    const req = await getRequest(path);
    setCurrentPath(path);
    applyDraft(req, true);
  }

  async function onNewRequest() {
    const path = window.prompt("请求路径（如 auth/ping）")?.trim();
    if (!path) return;
    const req = defaultDraft();
    const segs = path.split("/").filter(Boolean);
    req.name = segs[segs.length - 1] ?? path;
    await createRequest(path, req);
    await reloadWorkspace();
    setCurrentPath(path);
    applyDraft(req, true);
  }

  function onSelectHistory(entry: HistoryEntry) {
    applyDraft(entry.request);
    if (entry.requestPath) setCurrentPath(entry.requestPath);
    setResult(parseHistoryResult(entry.result));
  }

  async function onSend() {
    const id = crypto.randomUUID();
    setExecuteId(id);
    setSending(true);
    setError(null);
    try {
      const { result: res } = await execute(
        draft,
        currentPath ?? undefined,
        id,
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function onStop() {
    if (!executeId) return;
    try {
      await cancelExecute(executeId);
    } catch {
      // execute 可能已结束，忽略 404
    }
  }

  async function onSave() {
    let path = currentPath;
    if (!path) {
      path = window.prompt("请求路径（如 auth/ping）")?.trim() ?? "";
      if (!path) return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await putRequest(path, draft);
      setCurrentPath(path);
      applyDraft(saved, true);
      await reloadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app">
      <TopBar
        cwd={workspace?.cwd ?? ""}
        envs={envs}
        local={local}
        onEnvChange={onEnvChange}
        onSecretsChange={onSecretsChange}
      />
      {error && <div className="banner error">{error}</div>}
      <div className="main">
        <Sidebar
          requests={workspace?.requests ?? []}
          currentPath={currentPath}
          tabLeft={tabLeft}
          sending={sending}
          onTabLeft={setTabLeft}
          onSelectRequest={onSelectRequest}
          onNewRequest={onNewRequest}
          onSelectHistory={onSelectHistory}
        />
        <RequestEditor
          draft={draft}
          dirty={dirty}
          sending={sending}
          saving={saving}
          onChange={(next) => applyDraft(next)}
          onSend={onSend}
          onStop={onStop}
          onSave={onSave}
        />
        <ResponsePane result={result} />
      </div>
    </div>
  );
}
