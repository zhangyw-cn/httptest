import { useCallback, useEffect, useRef, useState } from "react";
import { newId } from "./id";
import {
  cancelExecute,
  createRequest,
  deleteEnvironment,
  deleteHosts,
  deleteOverride,
  deleteRequest,
  execute,
  getEnvironments,
  getHosts,
  getLocal,
  getOverrides,
  getRequest,
  getWorkspace,
  putEnvironment,
  putHosts,
  putLocal,
  putOverride,
  putRequest,
  renameEnvironment,
  renameHosts,
  renameOverride,
} from "./api";
import {
  clickActivityIcon,
  togglePanel,
  type LeftState,
  type LeftView,
} from "./activity";
import ActivityBar from "./ActivityBar";
import Dialog, { type DialogMode } from "./Dialog";
import EnvEditor from "./EnvEditor";
import HostsContentEditor from "./HostsContentEditor";
import ErrorBoundary from "./ErrorBoundary";
import RequestEditor from "./RequestEditor";
import ResultPane from "./ResultPane";
import SettingsPane from "./SettingsPane";
import SettingsSidebar from "./SettingsSidebar";
import type { SettingsCategory } from "./settings";
import { workMode } from "./work-layout";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import UrlBar from "./UrlBar";
import {
  applyEnvSaveResult,
  envNameError,
  environmentAPIError,
  isEnvDirty,
  newEnvPair,
  openEnvForEdit,
  pairsToVars,
  varsJSON,
  varsToPairs,
  type EnvPair,
} from "./env";
import {
  hostPairsToMappings,
  hostsAPIError,
  hostsDeleteDialog,
  hostsNameError,
  hostsNewBlockedReason,
  hostsRenameConfirmDialog,
  validateHostsFile,
} from "./hosts";
import {
  overrideAPIError,
  overrideDeleteDialog,
  overrideNameError,
  overrideRenameConfirmDialog,
} from "./override";
import { defaultDraft, normalizeRequest, parseHistoryResult } from "./request";
import {
  shortcutFromEvent,
  shouldSaveOnCtrlS,
  shouldSendOnEnter,
} from "./shortcut";
import {
  applyTheme,
  readStoredTheme,
  writeStoredTheme,
  type ThemePref,
} from "./theme";
import type {
  Environment,
  HistoryEntry,
  HostsFile,
  HostsType,
  HttpRequest,
  LocalConfig,
  Override,
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
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [editingOverride, setEditingOverride] = useState<string | null>(null);
  const [overridePairs, setOverridePairs] = useState<EnvPair[]>(() =>
    varsToPairs({}),
  );
  const [overrideDirty, setOverrideDirty] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [hostsList, setHostsList] = useState<HostsFile[]>([]);
  const [editingHosts, setEditingHosts] = useState<string | null>(null);
  const [editingHostsType, setEditingHostsType] = useState<HostsType | null>(
    null,
  );
  const [hostsPairs, setHostsPairs] = useState<EnvPair[]>(() => [newEnvPair()]);
  const [hostsContent, setHostsContent] = useState("");
  const [hostsDirty, setHostsDirty] = useState(false);
  const [hostsSaving, setHostsSaving] = useState(false);
  const [hostsError, setHostsError] = useState<string | null>(null);
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
  const [settingsCategory, setSettingsCategory] =
    useState<SettingsCategory>("appearance");
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
  const editingOverrideRef = useRef(editingOverride);
  editingOverrideRef.current = editingOverride;
  const overrideSavingRef = useRef(overrideSaving);
  overrideSavingRef.current = overrideSaving;
  const overrideEpochRef = useRef(0);
  const overrideSavedRef = useRef(varsJSON({}));
  const overridePairsRef = useRef(overridePairs);
  overridePairsRef.current = overridePairs;
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const editingHostsRef = useRef(editingHosts);
  editingHostsRef.current = editingHosts;
  const hostsSavingRef = useRef(hostsSaving);
  hostsSavingRef.current = hostsSaving;
  const hostsEpochRef = useRef(0);
  const hostsSavedRef = useRef(varsJSON({}));
  const hostsPairsRef = useRef(hostsPairs);
  hostsPairsRef.current = hostsPairs;
  const hostsContentRef = useRef(hostsContent);
  hostsContentRef.current = hostsContent;
  const editingHostsTypeRef = useRef(editingHostsType);
  editingHostsTypeRef.current = editingHostsType;
  const hostsListRef = useRef(hostsList);
  hostsListRef.current = hostsList;
  const hostsErrorRef = useRef(hostsError);
  hostsErrorRef.current = hostsError;

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

  const loadOverride = useCallback((override: Override) => {
    overrideEpochRef.current += 1;
    setEditingOverride(override.name);
    setOverridePairs(varsToPairs(override.variables));
    overrideSavedRef.current = varsJSON(override.variables);
    setOverrideDirty(false);
    setOverrideError(null);
  }, []);

  const loadHosts = useCallback((h: HostsFile) => {
    hostsEpochRef.current += 1;
    setEditingHosts(h.name);
    setEditingHostsType(h.type);
    if (h.type === "hosts") {
      setHostsContent(h.content ?? "");
      hostsSavedRef.current = h.content ?? "";
      setHostsPairs([newEnvPair()]);
    } else {
      setHostsPairs(varsToPairs(h.mappings ?? {}));
      hostsSavedRef.current = varsJSON(h.mappings ?? {});
      setHostsContent("");
    }
    setHostsDirty(false);
    setHostsError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ws, loc, environments, overrideList] = await Promise.all([
          getWorkspace(),
          getLocal(),
          getEnvironments(),
          getOverrides(),
        ]);
        if (cancelled) return;
        setWorkspace(ws);
        setLocal(loc);
        setEnvs(environments);
        setOverrides(overrideList);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
      try {
        const hosts = await getHosts();
        if (!cancelled) {
          setHostsList(hosts);
          setHostsError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setHostsList([]);
          setHostsError(
            hostsAPIError(err instanceof Error ? err.message : String(err)),
          );
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

  async function onOverrideChange(override: string) {
    if (!local || local.override === override) return;
    const next = { ...local, override };
    const saved = await putLocal(next);
    setLocal(saved);
  }

  async function onHostsChange(hosts: string) {
    if (!local || local.hosts === hosts) return;
    const next = { ...local, hosts };
    setLocal(await putLocal(next));
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
    if (envSavingRef.current) return;
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
    if (envSavingRef.current) return;
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
    if (envSavingRef.current) return;
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

  function onSelectOverride(name: string) {
    const override = overrides.find((item) => item.name === name);
    if (!override) return;
    loadOverride(override);
  }

  function onOverridePairsChange(next: EnvPair[]) {
    overrideEpochRef.current += 1;
    setOverridePairs(next);
    setOverrideDirty(isEnvDirty(next, overrideSavedRef.current));
  }

  function openNewOverrideDialog() {
    if (overrideSavingRef.current) return;
    setDialogError(null);
    setDialog({
      kind: "path",
      title: "覆盖名",
      submitLabel: "创建",
      error: null,
      intent: "create-override",
      hint: "文件名，例如 default，不能含 /",
    });
  }

  function openDeleteOverrideDialog(name: string) {
    if (overrideSavingRef.current) return;
    const isActive = local?.override === name;
    setDialogError(null);
    setDialog(overrideDeleteDialog(name, isActive));
  }

  function openRenameOverrideDialog() {
    if (overrideSavingRef.current) return;
    const name = editingOverrideRef.current;
    if (!name) return;
    setDialogError(null);
    setDialog({
      kind: "path",
      title: "重命名覆盖",
      submitLabel: "重命名",
      error: null,
      intent: "rename-override",
      hint: "文件名，例如 default，不能含 /",
    });
  }

  function onSelectHosts(name: string) {
    const h = hostsList.find((item) => item.name === name);
    if (!h) return;
    loadHosts(h);
  }

  function openNewHostsDialog() {
    const blocked = hostsNewBlockedReason(
      hostsErrorRef.current,
      hostsSavingRef.current,
    );
    if (blocked) return;
    setDialogError(null);
    setDialog({
      kind: "path",
      title: "新建 Hosts",
      submitLabel: "创建",
      error: null,
      intent: "create-hosts",
      hint: "文件名，例如 lan，不能含 /",
    });
  }

  function openDeleteHostsDialog(name: string) {
    if (hostsSavingRef.current) return;
    const isActive = local?.hosts === name;
    setDialogError(null);
    setDialog(hostsDeleteDialog(name, isActive));
  }

  function openRenameHostsDialog() {
    if (hostsSavingRef.current) return;
    const name = editingHostsRef.current;
    if (!name) return;
    setDialogError(null);
    setDialog({
      kind: "path",
      title: "重命名 Hosts",
      submitLabel: "重命名",
      error: null,
      intent: "rename-hosts",
      hint: "文件名，例如 lan，不能含 /",
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
      const apply = applyEnvSaveResult({
        savedName: name,
        editingName: editingEnvRef.current,
        epochAtStart: epoch,
        epochNow: envEpochRef.current,
        currentPairs: envPairsRef.current,
        saved,
      });
      if (apply.action === "reload") {
        setEditingEnv(apply.env.name);
        envSavedRef.current = varsJSON(apply.env.variables);
        setEnvDirty(false);
      } else if (apply.action === "keep") {
        envSavedRef.current = apply.snapshot;
        setEnvDirty(apply.dirty);
      }
    } catch (err) {
      setEnvError(
        environmentAPIError(err instanceof Error ? err.message : String(err)),
      );
    } finally {
      envSavingRef.current = false;
      setEnvSaving(false);
    }
  }, []);

  const onSaveOverride = useCallback(async () => {
    if (overrideSavingRef.current) return;
    const name = editingOverrideRef.current;
    if (!name) return;
    if (
      !isEnvDirty(overridePairsRef.current, overrideSavedRef.current)
    ) {
      return;
    }
    const variables = pairsToVars(overridePairsRef.current);
    const epoch = overrideEpochRef.current;
    overrideSavingRef.current = true;
    setOverrideSaving(true);
    setOverrideError(null);
    try {
      const saved = await putOverride(name, { name, variables });
      const list = await getOverrides();
      setOverrides(list);
      const apply = applyEnvSaveResult({
        savedName: name,
        editingName: editingOverrideRef.current,
        epochAtStart: epoch,
        epochNow: overrideEpochRef.current,
        currentPairs: overridePairsRef.current,
        saved,
      });
      if (apply.action === "reload") {
        setEditingOverride(apply.env.name);
        overrideSavedRef.current = varsJSON(apply.env.variables);
        setOverrideDirty(false);
      } else if (apply.action === "keep") {
        overrideSavedRef.current = apply.snapshot;
        setOverrideDirty(apply.dirty);
      }
    } catch (err) {
      setOverrideError(
        overrideAPIError(err instanceof Error ? err.message : String(err)),
      );
    } finally {
      overrideSavingRef.current = false;
      setOverrideSaving(false);
    }
  }, []);

  const onSaveHosts = useCallback(async () => {
    if (hostsSavingRef.current) return;
    const name = editingHostsRef.current;
    if (!name) return;
    const hostsType = editingHostsTypeRef.current ?? "map";
    if (hostsType === "hosts") {
      if (hostsContentRef.current === hostsSavedRef.current) return;
    } else if (!isEnvDirty(hostsPairsRef.current, hostsSavedRef.current)) {
      return;
    }
    const epoch = hostsEpochRef.current;
    hostsSavingRef.current = true;
    setHostsSaving(true);
    setHostsError(null);
    try {
      if (hostsType === "hosts") {
        const content = hostsContentRef.current;
        const vErr = validateHostsFile({
          type: "hosts",
          content,
          mappings: {},
        });
        if (vErr) {
          setHostsError(vErr);
          return;
        }
        const saved = await putHosts(name, {
          name,
          type: "hosts",
          content,
          mappings: {},
        });
        if (
          editingHostsRef.current === name &&
          hostsEpochRef.current === epoch
        ) {
          hostsSavedRef.current = saved.content;
          setHostsContent(saved.content);
          setHostsDirty(false);
        }
        try {
          setHostsList(await getHosts());
          setHostsError(null);
        } catch (err) {
          // Keep prior list + editor; saved file is on disk.
          setHostsError(
            `已保存，但 Hosts 列表无法刷新：${hostsAPIError(err instanceof Error ? err.message : String(err))}`,
          );
        }
        return;
      }
      const converted = hostPairsToMappings(hostsPairsRef.current);
      if (!converted.ok) {
        setHostsError(converted.error);
        return;
      }
      const mappings = converted.mappings;
      const vErr = validateHostsFile({
        type: "map",
        mappings,
        content: "",
      });
      if (vErr) {
        setHostsError(vErr);
        return;
      }
      const saved = await putHosts(name, {
        name,
        type: "map",
        mappings,
        content: "",
      });
      const apply = applyEnvSaveResult({
        savedName: name,
        editingName: editingHostsRef.current,
        epochAtStart: epoch,
        epochNow: hostsEpochRef.current,
        currentPairs: hostsPairsRef.current,
        saved: { name: saved.name, variables: saved.mappings },
      });
      if (apply.action === "reload") {
        setEditingHosts(apply.env.name);
        hostsSavedRef.current = varsJSON(apply.env.variables);
        setHostsDirty(false);
      } else if (apply.action === "keep") {
        hostsSavedRef.current = apply.snapshot;
        setHostsDirty(apply.dirty);
      }
      try {
        setHostsList(await getHosts());
        setHostsError(null);
      } catch (err) {
        // Keep prior list + editor; saved file is on disk.
        setHostsError(
          `已保存，但 Hosts 列表无法刷新：${hostsAPIError(err instanceof Error ? err.message : String(err))}`,
        );
      }
    } catch (err) {
      setHostsError(
        hostsAPIError(err instanceof Error ? err.message : String(err)),
      );
    } finally {
      hostsSavingRef.current = false;
      setHostsSaving(false);
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

  async function onDialogSubmit(
    path?: string,
    opts?: { hostsType?: HostsType },
  ) {
    const current = dialogRef.current;
    if (!current) return;
    setDialogError(null);
    try {
      if (current.kind === "path") {
        const p = path?.trim() ?? "";
        if (!p) return;
        if (current.intent === "rename-hosts") {
          if (hostsSavingRef.current) {
            setDialogError("请等待 Hosts 保存完成");
            return;
          }
          const oldName = editingHostsRef.current;
          if (!oldName) return;
          if (p === oldName) {
            setDialogError("不能改成当前名称");
            return;
          }
          const others = hostsListRef.current
            .map((item) => item.name)
            .filter((name) => name !== oldName);
          const err = hostsNameError(p, others);
          if (err) {
            setDialogError(err);
            return;
          }
          if (local?.hosts === oldName) {
            setDialog(hostsRenameConfirmDialog(oldName, p));
            return;
          }
          const renamed = await renameHosts(oldName, p);
          const [list, loc] = await Promise.all([getHosts(), getLocal()]);
          setHostsList(list);
          setLocal(loc);
          loadHosts(renamed);
          setDialog(null);
          setDialogError(null);
          return;
        }
        if (current.intent === "rename-override") {
          if (overrideSavingRef.current) {
            setDialogError("请等待覆盖保存完成");
            return;
          }
          const oldName = editingOverrideRef.current;
          if (!oldName) return;
          if (p === oldName) {
            setDialogError("不能改成当前名称");
            return;
          }
          const others = overridesRef.current
            .map((item) => item.name)
            .filter((name) => name !== oldName);
          const err = overrideNameError(p, others);
          if (err) {
            setDialogError(err);
            return;
          }
          if (local?.override === oldName) {
            setDialog(overrideRenameConfirmDialog(oldName, p));
            return;
          }
          const renamed = await renameOverride(oldName, p);
          const [list, loc] = await Promise.all([
            getOverrides(),
            getLocal(),
          ]);
          setOverrides(list);
          setLocal(loc);
          loadOverride(renamed);
          setDialog(null);
          setDialogError(null);
          return;
        }
        if (current.intent === "rename-env") {
          if (envSavingRef.current) {
            setDialogError("请等待环境保存完成");
            return;
          }
          const oldName = editingEnvRef.current;
          if (!oldName) return;
          if (p === oldName) {
            setDialogError("不能改成当前名称");
            return;
          }
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
          if (envSavingRef.current) {
            setDialogError("请等待环境保存完成");
            return;
          }
          const err = envNameError(
            p,
            envs.map((env) => env.name),
          );
          if (err) {
            setDialogError(err);
            return;
          }
          await putEnvironment(p, {
            name: p,
            variables: {},
          });
          const list = await getEnvironments();
          setEnvs(list);
          loadEnv({ name: p, variables: {} });
          setDialog(null);
          setDialogError(null);
          return;
        }
        if (current.intent === "create-override") {
          if (overrideSavingRef.current) {
            setDialogError("请等待覆盖保存完成");
            return;
          }
          const err = overrideNameError(
            p,
            overridesRef.current.map((item) => item.name),
          );
          if (err) {
            setDialogError(err);
            return;
          }
          await putOverride(p, { name: p, variables: {} });
          const list = await getOverrides();
          setOverrides(list);
          loadOverride({ name: p, variables: {} });
          setDialog(null);
          setDialogError(null);
          return;
        }
        if (current.intent === "create-hosts") {
          const blocked = hostsNewBlockedReason(
            hostsErrorRef.current,
            hostsSavingRef.current,
          );
          if (blocked) {
            setDialogError(blocked);
            return;
          }
          const err = hostsNameError(
            p,
            hostsListRef.current.map((item) => item.name),
          );
          if (err) {
            setDialogError(err);
            return;
          }
          const hostsType = opts?.hostsType ?? "map";
          await putHosts(p, {
            name: p,
            type: hostsType,
            mappings: {},
            content: "",
          });
          const list = await getHosts();
          setHostsList(list);
          loadHosts({
            name: p,
            type: hostsType,
            mappings: {},
            content: "",
          });
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
        if (current.subject === "hosts") {
          if (hostsSavingRef.current) {
            setDialogError("请等待 Hosts 保存完成");
            return;
          }
          if (current.next) {
            const renamed = await renameHosts(current.path, current.next);
            const [list, loc] = await Promise.all([getHosts(), getLocal()]);
            setHostsList(list);
            setLocal(loc);
            loadHosts(renamed);
          } else {
            await deleteHosts(current.path);
            const [list, loc] = await Promise.all([getHosts(), getLocal()]);
            setHostsList(list);
            setLocal(loc);
            if (editingHostsRef.current === current.path) {
              hostsEpochRef.current += 1;
              setEditingHosts(null);
              setEditingHostsType(null);
              setHostsPairs([newEnvPair()]);
              setHostsContent("");
              setHostsDirty(false);
            }
          }
          setDialog(null);
          setDialogError(null);
          return;
        }
        if (current.subject === "override") {
          if (overrideSavingRef.current) {
            setDialogError("请等待覆盖保存完成");
            return;
          }
          if (current.next) {
            const renamed = await renameOverride(current.path, current.next);
            const [list, loc] = await Promise.all([
              getOverrides(),
              getLocal(),
            ]);
            setOverrides(list);
            setLocal(loc);
            loadOverride(renamed);
          } else {
            await deleteOverride(current.path);
            const [list, loc] = await Promise.all([
              getOverrides(),
              getLocal(),
            ]);
            setOverrides(list);
            setLocal(loc);
            if (editingOverrideRef.current === current.path) {
              overrideEpochRef.current += 1;
              setEditingOverride(null);
              setOverridePairs(varsToPairs({}));
              setOverrideDirty(false);
            }
          }
          setDialog(null);
          setDialogError(null);
          return;
        }
        if (current.subject === "environment") {
          if (envSavingRef.current) {
            setDialogError("请等待环境保存完成");
            return;
          }
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
      const message = err instanceof Error ? err.message : String(err);
      const envOp =
        (current.kind === "path" &&
          (current.intent === "create-env" ||
            current.intent === "rename-env")) ||
        (current.kind === "confirm" && current.subject === "environment");
      const overrideOp =
        (current.kind === "path" &&
          (current.intent === "create-override" ||
            current.intent === "rename-override")) ||
        (current.kind === "confirm" && current.subject === "override");
      const hostsOp =
        (current.kind === "path" &&
          (current.intent === "create-hosts" ||
            current.intent === "rename-hosts")) ||
        (current.kind === "confirm" && current.subject === "hosts");
      setDialogError(
        hostsOp
          ? hostsAPIError(message)
          : overrideOp
            ? overrideAPIError(message)
            : envOp
              ? environmentAPIError(message)
              : message,
      );
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
        if (!shouldSendOnEnter(leftRef.current.view)) return;
        if (!sendingRef.current) void onSend();
      } else if (action === "save") {
        if (!shouldSaveOnCtrlS(leftRef.current.view)) {
          return;
        }
        if (leftRef.current.view === "environment") {
          void onSaveEnv();
        } else if (leftRef.current.view === "override") {
          void onSaveOverride();
        } else if (leftRef.current.view === "hosts") {
          void onSaveHosts();
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
  }, [onSave, onSaveEnv, onSaveHosts, onSaveOverride, onSend, onStop]);

  const dialogMode =
    dialog === null
      ? null
      : { ...dialog, error: dialogError ?? dialog.error };

  const mode = workMode(left.view);

  return (
    <div className="app">
      <TopBar
        workdir={workspace?.workdir ?? ""}
        envs={envs}
        overrides={overrides}
        hosts={hostsList}
        local={local}
        onEnvChange={onEnvChange}
        onOverrideChange={onOverrideChange}
        onHostsChange={onHostsChange}
      />
      {error && <div className="banner error">{error}</div>}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <div className="main" {...(dialogMode ? { inert: "" } : {})}>
        <ActivityBar
          view={left.view}
          panelOpen={left.panelOpen}
          onClickIcon={(icon) => setLeft((s) => clickActivityIcon(s, icon))}
        />
        {left.panelOpen &&
          (mode === "settings" ? (
            <SettingsSidebar
              category={settingsCategory}
              onSelect={setSettingsCategory}
            />
          ) : (
            <Sidebar
              requests={workspace?.requests ?? []}
              currentPath={currentPath}
              view={left.view as Exclude<LeftView, "settings">}
              sending={sending}
              envs={envs}
              editingEnv={editingEnv}
              activeEnv={local?.environment ?? ""}
              overrides={overrides}
              editingOverride={editingOverride}
              activeOverride={local?.override ?? ""}
              onSelectRequest={onSelectRequest}
              onNewRequest={openNewDialog}
              onDeleteRequest={openDeleteDialog}
              onSelectHistory={onSelectHistory}
              onSelectEnv={onSelectEnv}
              onNewEnv={openNewEnvDialog}
              onDeleteEnv={openDeleteEnvDialog}
              onSelectOverride={onSelectOverride}
              onNewOverride={openNewOverrideDialog}
              onDeleteOverride={openDeleteOverrideDialog}
              hostsList={hostsList}
              editingHosts={editingHosts}
              activeHosts={local?.hosts ?? ""}
              onSelectHosts={onSelectHosts}
              onNewHosts={openNewHostsDialog}
              onDeleteHosts={openDeleteHostsDialog}
              envBusy={envSaving}
              overrideBusy={overrideSaving}
              hostsBusy={hostsSaving}
              hostsListError={hostsError}
            />
          ))}
        <div className="work">
          {mode === "settings" ? (
            <SettingsPane
              category={settingsCategory}
              theme={theme}
              onThemeChange={onThemeChange}
            />
          ) : mode === "environment" ? (
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
          ) : mode === "override" ? (
            <EnvEditor
              name={editingOverride}
              pairs={overridePairs}
              dirty={overrideDirty}
              saving={overrideSaving}
              error={overrideError}
              emptyTitle="在左侧选择一套覆盖，或新建"
              maskValues
              onPairsChange={onOverridePairsChange}
              onSave={() => void onSaveOverride()}
              onRename={openRenameOverrideDialog}
            />
          ) : mode === "hosts" ? (
            editingHostsType === "hosts" ? (
              <HostsContentEditor
                name={editingHosts}
                hostsType="hosts"
                content={hostsContent}
                dirty={hostsDirty}
                saving={hostsSaving}
                error={hostsError}
                emptyTitle="在左侧选择一套 Hosts，或新建"
                onContentChange={(next) => {
                  hostsEpochRef.current += 1;
                  setHostsContent(next);
                  setHostsDirty(next !== hostsSavedRef.current);
                }}
                onSave={() => void onSaveHosts()}
                onRename={openRenameHostsDialog}
              />
            ) : (
              <div className="hosts-editor-map">
                <EnvEditor
                  name={editingHosts}
                  pairs={hostsPairs}
                  dirty={hostsDirty}
                  saving={hostsSaving}
                  error={hostsError}
                  emptyTitle="在左侧选择一套 Hosts，或新建"
                  keyHeader="主机名"
                  valueHeader="IP"
                  onPairsChange={(next) => {
                    hostsEpochRef.current += 1;
                    setHostsPairs(next);
                    setHostsDirty(isEnvDirty(next, hostsSavedRef.current));
                  }}
                  onSave={() => void onSaveHosts()}
                  onRename={openRenameHostsDialog}
                />
              </div>
            )
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
                  <ResultPane result={result} />
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
          onSubmit={(p, opts) => onDialogSubmit(p, opts)}
        />
      )}
    </div>
  );
}
