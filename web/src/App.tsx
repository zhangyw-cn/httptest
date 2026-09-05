import { useCallback, useEffect, useRef, useState } from "react";
import { newId } from "./id";
import {
  cancelExecute,
  createRequest,
  deleteRequest,
  execute,
  getEnvironments,
  getLocal,
  getRequest,
  getWorkspace,
  putLocal,
  putRequest,
} from "./api";
import {
  clickActivityIcon,
  togglePanel,
  type LeftState,
} from "./activity";
import ActivityBar from "./ActivityBar";
import Dialog, { type DialogMode } from "./Dialog";
import ErrorBoundary from "./ErrorBoundary";
import RequestEditor from "./RequestEditor";
import ResponsePane from "./ResponsePane";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import UrlBar from "./UrlBar";
import { defaultDraft, normalizeRequest, parseHistoryResult } from "./request";
import { shortcutFromEvent } from "./shortcut";
import {
  applyTheme,
  readStoredTheme,
  writeStoredTheme,
  type ThemePref,
} from "./theme";
import type {
  Environment,
  HistoryEntry,
  HttpRequest,
  LocalConfig,
  Result,
  WorkspaceInfo,
} from "./types";

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [local, setLocal] = useState<LocalConfig | null>(null);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [draft, setDraft] = useState<HttpRequest>(defaultDraft);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [executeId, setExecuteId] = useState<string | null>(null);
  const [left, setLeft] = useState<LeftState>({
    view: "collection",
    panelOpen: true,
  });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePref>(() => readStoredTheme());
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const savedRef = useRef(JSON.stringify(defaultDraft()));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const sendingRef = useRef(sending);
  sendingRef.current = sending;
  const executeIdRef = useRef(executeId);
  executeIdRef.current = executeId;
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;

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

  function onThemeChange(pref: ThemePref) {
    setTheme(pref);
    writeStoredTheme(pref);
    applyTheme(pref);
  }

  async function onSelectRequest(path: string) {
    const req = await getRequest(path);
    setCurrentPath(path);
    applyDraft(req, true);
  }

  function openNewDialog() {
    setDialogError(null);
    setDialog({
      kind: "path",
      title: "请求路径",
      submitLabel: "创建",
      error: null,
      intent: "create",
    });
  }

  function openDeleteDialog(path: string) {
    setDialogError(null);
    setDialog({
      kind: "confirm",
      title: "删除请求",
      body: `删除 ${path}？此操作会从磁盘去掉该文件。`,
      submitLabel: "删除",
      error: null,
      path,
    });
  }

  function onSelectHistory(entry: HistoryEntry) {
    applyDraft(entry.request);
    if (entry.requestPath) setCurrentPath(entry.requestPath);
    else setCurrentPath(null);
    setResult(parseHistoryResult(entry.result));
  }

  const onSend = useCallback(async () => {
    const id = newId();
    setExecuteId(id);
    setSending(true);
    setError(null);
    try {
      const { result: res } = await execute(
        draftRef.current,
        currentPathRef.current ?? undefined,
        id,
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, []);

  const onStop = useCallback(async () => {
    const id = executeIdRef.current;
    if (!id) return;
    try {
      await cancelExecute(id);
    } catch {
      // execute 可能已结束，忽略 404
    }
  }, []);

  const saveToPath = useCallback(async (path: string) => {
    setSaving(true);
    try {
      const saved = await putRequest(path, draftRef.current);
      setCurrentPath(path);
      applyDraft(saved, true);
      await reloadWorkspace();
    } finally {
      setSaving(false);
    }
  }, [applyDraft, reloadWorkspace]);

  const onSave = useCallback(async () => {
    const path = currentPathRef.current;
    if (!path) {
      setDialogError(null);
      setDialog({
        kind: "path",
        title: "请求路径",
        submitLabel: "保存",
        error: null,
        intent: "save",
      });
      return;
    }
    setError(null);
    try {
      await saveToPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [saveToPath]);

  async function onDialogSubmit(path?: string) {
    const current = dialogRef.current;
    if (!current) return;
    setDialogError(null);
    try {
      if (current.kind === "path") {
        const p = path?.trim() ?? "";
        if (!p) return;
        if (current.intent === "create") {
          const req = defaultDraft();
          const segs = p.split("/").filter(Boolean);
          req.name = segs[segs.length - 1] ?? p;
          await createRequest(p, req);
          await reloadWorkspace();
          setCurrentPath(p);
          applyDraft(req, true);
        } else {
          await saveToPath(p);
        }
      } else {
        await deleteRequest(current.path);
        if (currentPathRef.current === current.path) {
          setCurrentPath(null);
          applyDraft(defaultDraft(), true);
          setResult(null);
        }
        await reloadWorkspace();
      }
      setDialog(null);
      setDialogError(null);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const action = shortcutFromEvent(e, {
        dialogOpen: dialogRef.current !== null,
      });
      if (!action) return;
      if (action === "save" || action === "block-browser-save") {
        e.preventDefault();
      }
      if (action === "send") {
        e.preventDefault();
        if (!sendingRef.current) void onSend();
      } else if (action === "save") {
        void onSave();
      } else if (action === "toggle-panel") {
        e.preventDefault();
        setLeft((s) => togglePanel(s));
      } else if (action === "escape") {
        if (dialogRef.current) {
          setDialog(null);
          setDialogError(null);
        } else if (sendingRef.current) {
          void onStop();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, onSend, onStop]);

  const dialogMode =
    dialog === null
      ? null
      : { ...dialog, error: dialogError ?? dialog.error };

  return (
    <div className="app">
      <TopBar
        workdir={workspace?.workdir ?? ""}
        envs={envs}
        local={local}
        theme={theme}
        onThemeChange={onThemeChange}
        onEnvChange={onEnvChange}
        onSecretsChange={onSecretsChange}
      />
      {error && <div className="banner error">{error}</div>}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <div className="main" {...(dialogMode ? { inert: "" } : {})}>
        <ActivityBar
          view={left.view}
          panelOpen={left.panelOpen}
          onClickIcon={(icon) => setLeft((s) => clickActivityIcon(s, icon))}
        />
        {left.panelOpen && (
          <Sidebar
            requests={workspace?.requests ?? []}
            currentPath={currentPath}
            view={left.view}
            sending={sending}
            onSelectRequest={onSelectRequest}
            onNewRequest={openNewDialog}
            onDeleteRequest={openDeleteDialog}
            onSelectHistory={onSelectHistory}
          />
        )}
        <div className="work">
          <UrlBar
            draft={draft}
            dirty={dirty}
            sending={sending}
            saving={saving}
            onChange={(next) => applyDraft(next)}
            onSend={() => void onSend()}
            onStop={() => void onStop()}
            onSave={() => void onSave()}
          />
          <div className="panes">
            <RequestEditor
              draft={draft}
              onChange={(next) => applyDraft(next)}
            />
            <ErrorBoundary>
              <ResponsePane result={result} />
            </ErrorBoundary>
          </div>
        </div>
      </div>
      {dialogMode && (
        <Dialog
          key={
            dialogMode.kind === "path"
              ? dialogMode.intent
              : dialogMode.path
          }
          mode={dialogMode}
          onClose={() => {
            setDialog(null);
            setDialogError(null);
          }}
          onSubmit={(p) => void onDialogSubmit(p)}
        />
      )}
    </div>
  );
}
