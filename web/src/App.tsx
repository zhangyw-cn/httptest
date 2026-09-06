import { useCallback, useEffect, useRef, useState } from "react";
import { newId } from "./id";
import {
  cancelExecute,
  createRequest,
  deleteEnvironment,
  deleteRequest,
  execute,
  getEnvironments,
  getLocal,
  getRequest,
  getWorkspace,
  putEnvironment,
  putLocal,
  putRequest,
  renameEnvironment,
} from "./api";
import {
  clickActivityIcon,
  togglePanel,
  type LeftState,
} from "./activity";
import ActivityBar from "./ActivityBar";
import Dialog, { type DialogMode } from "./Dialog";
import EnvEditor from "./EnvEditor";
import ErrorBoundary from "./ErrorBoundary";
import RequestEditor from "./RequestEditor";
import ResponsePane from "./ResponsePane";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import UrlBar from "./UrlBar";
import {
  envNameError,
  isEnvDirty,
  openEnvForEdit,
  pairsToVars,
  varsJSON,
  varsToPairs,
  type EnvPair,
} from "./env";
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
  const [editingEnv, setEditingEnv] = useState<string | null>(null);
  const [envPairs, setEnvPairs] = useState<EnvPair[]>(() => varsToPairs({}));
  const [envDirty, setEnvDirty] = useState(false);
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
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
  const editingEnvRef = useRef(editingEnv);
  editingEnvRef.current = editingEnv;
  const envSavingRef = useRef(envSaving);
  envSavingRef.current = envSaving;
  const envEpochRef = useRef(0);
  const sendingRef = useRef(sending);
  sendingRef.current = sending;
  const executeIdRef = useRef(executeId);
  executeIdRef.current = executeId;
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const envSavedRef = useRef(varsJSON({}));
  const envPairsRef = useRef(envPairs);
  envPairsRef.current = envPairs;
  const leftRef = useRef(left);
  leftRef.current = left;
  const envsRef = useRef(envs);
  envsRef.current = envs;

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

  const loadEnv = useCallback((env: Environment) => {
    envEpochRef.current += 1;
    const opened = openEnvForEdit(env);
    setEditingEnv(opened.name);
    setEnvPairs(opened.pairs);
    envSavedRef.current = opened.snapshot;
    setEnvDirty(false);
    setEnvError(null);
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

  function onSelectEnv(name: string) {
    const env = envs.find((e) => e.name === name);
    if (!env) return;
    loadEnv(env);
  }

  function onEnvPairsChange(next: EnvPair[]) {
    envEpochRef.current += 1;
    setEnvPairs(next);
    setEnvDirty(isEnvDirty(next, envSavedRef.current));
  }

  function openNewEnvDialog() {
    setDialogError(null);
    setDialog({
      kind: "path",
      title: "环境名",
      submitLabel: "创建",
      error: null,
      intent: "create-env",
      hint: "文件名，例如 local，不能含 /",
    });
  }

  function openDeleteEnvDialog(name: string) {
    const isActive = local?.environment === name;
    setDialogError(null);
    setDialog({
      kind: "confirm",
      title: "删除环境",
      body: isActive
        ? `删除 ${name}？此操作会从磁盘去掉该文件。顶栏当前环境将变为未选择。`
        : `删除 ${name}？此操作会从磁盘去掉该文件。`,
      submitLabel: "删除",
      error: null,
      path: name,
      subject: "environment",
    });
  }

  function openRenameEnvDialog() {
    const name = editingEnvRef.current;
    if (!name) return;
    const isActive = local?.environment === name;
    setDialogError(null);
    setDialog({
      kind: "path",
      title: "重命名环境",
      submitLabel: "重命名",
      error: null,
      intent: "rename-env",
      hint: isActive
        ? "文件名，例如 local，不能含 /。顶栏当前环境将改为新名称。"
        : "文件名，例如 local，不能含 /",
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

  const onSaveEnv = useCallback(async () => {
    if (envSavingRef.current) return;
    const name = editingEnvRef.current;
    if (!name) return;
    if (!isEnvDirty(envPairsRef.current, envSavedRef.current)) return;
    const variables = pairsToVars(envPairsRef.current);
    const epoch = envEpochRef.current;
    envSavingRef.current = true;
    setEnvSaving(true);
    setEnvError(null);
    try {
      const saved = await putEnvironment(name, {
        name,
        variables,
      });
      const list = await getEnvironments();
      setEnvs(list);
      if (editingEnvRef.current !== name) return;
      const currentPairs = envPairsRef.current;
      if (envEpochRef.current === epoch) {
        loadEnv(saved);
      } else {
        envSavedRef.current = varsJSON(saved.variables);
        setEnvDirty(isEnvDirty(currentPairs, envSavedRef.current));
      }
    } catch (err) {
      setEnvError(err instanceof Error ? err.message : String(err));
    } finally {
      envSavingRef.current = false;
      setEnvSaving(false);
    }
  }, [loadEnv]);

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
        if (current.intent === "rename-env") {
          const oldName = editingEnvRef.current;
          if (!oldName) return;
          const others = envsRef.current
            .map((e) => e.name)
            .filter((n) => n !== oldName);
          const err = envNameError(p, others);
          if (err) {
            setDialogError(err);
            return;
          }
          const renamed = await renameEnvironment(oldName, p);
          const [list, loc] = await Promise.all([
            getEnvironments(),
            getLocal(),
          ]);
          setEnvs(list);
          setLocal(loc);
          loadEnv(renamed);
          setDialog(null);
          setDialogError(null);
          return;
        }
        if (current.intent === "create-env") {
          const err = envNameError(
            p,
            envs.map((env) => env.name),
          );
          if (err) {
            setDialogError(err);
            return;
          }
          await putEnvironment(p, { name: p, variables: {} });
          const list = await getEnvironments();
          setEnvs(list);
          loadEnv({ name: p, variables: {} });
          setDialog(null);
          setDialogError(null);
          return;
        }
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
        if (current.subject === "environment") {
          await deleteEnvironment(current.path);
          const [list, loc] = await Promise.all([
            getEnvironments(),
            getLocal(),
          ]);
          setEnvs(list);
          setLocal(loc);
          if (editingEnvRef.current === current.path) {
            envEpochRef.current += 1;
            setEditingEnv(null);
            setEnvPairs(varsToPairs({}));
            setEnvDirty(false);
          }
          setDialog(null);
          setDialogError(null);
          return;
        }
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
        if (leftRef.current.view === "environment") return;
        if (!sendingRef.current) void onSend();
      } else if (action === "save") {
        if (leftRef.current.view === "environment") {
          void onSaveEnv();
        } else {
          void onSave();
        }
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
  }, [onSave, onSaveEnv, onSend, onStop]);

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
            envs={envs}
            editingEnv={editingEnv}
            activeEnv={local?.environment ?? ""}
            onSelectRequest={onSelectRequest}
            onNewRequest={openNewDialog}
            onDeleteRequest={openDeleteDialog}
            onSelectHistory={onSelectHistory}
            onSelectEnv={onSelectEnv}
            onNewEnv={openNewEnvDialog}
            onDeleteEnv={openDeleteEnvDialog}
          />
        )}
        <div className="work">
          {left.view === "environment" ? (
            <EnvEditor
              name={editingEnv}
              pairs={envPairs}
              dirty={envDirty}
              saving={envSaving}
              error={envError}
              onPairsChange={onEnvPairsChange}
              onSave={() => void onSaveEnv()}
              onRename={openRenameEnvDialog}
            />
          ) : (
            <>
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
            </>
          )}
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
          onSubmit={(p) => onDialogSubmit(p)}
        />
      )}
    </div>
  );
}
