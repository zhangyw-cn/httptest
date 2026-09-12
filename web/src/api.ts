import { newId } from "./id";
import type {
  CreateRequestBody,
  Environment,
  ExecutePayload,
  HistoryEntry,
  HostsFile,
  HttpRequest,
  LocalConfig,
  Override,
  Result,
  WorkspaceInfo,
} from "./types";

async function parseJSON<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function getWorkspace(): Promise<WorkspaceInfo> {
  const res = await fetch("/api/workspace");
  return parseJSON<WorkspaceInfo>(res);
}

export async function getRequest(path: string): Promise<HttpRequest> {
  const res = await fetch(`/api/requests/${encodeURI(path)}`);
  return parseJSON<HttpRequest>(res);
}

export async function putRequest(
  path: string,
  request: HttpRequest,
): Promise<HttpRequest> {
  const res = await fetch(`/api/requests/${encodeURI(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return parseJSON<HttpRequest>(res);
}

export async function deleteRequest(path: string): Promise<void> {
  const res = await fetch(`/api/requests/${encodeURI(path)}`, {
    method: "DELETE",
  });
  await parseJSON<void>(res);
}

export async function createRequest(
  path: string,
  request: HttpRequest,
): Promise<HttpRequest> {
  const payload: CreateRequestBody = { path, request };
  const res = await fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJSON<HttpRequest>(res);
}

export async function getEnvironments(): Promise<Environment[]> {
  const res = await fetch("/api/environments");
  return parseJSON<Environment[]>(res);
}

export async function putEnvironment(
  name: string,
  env: Environment,
): Promise<Environment> {
  const res = await fetch(`/api/environments/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(env),
  });
  return parseJSON<Environment>(res);
}

export async function deleteEnvironment(name: string): Promise<void> {
  const res = await fetch(`/api/environments/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  await parseJSON<void>(res);
}

export async function renameEnvironment(
  name: string,
  next: string,
): Promise<Environment> {
  const res = await fetch(
    `/api/environments/${encodeURIComponent(name)}/rename`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    },
  );
  return parseJSON<Environment>(res);
}

export async function getOverrides(): Promise<Override[]> {
  const res = await fetch("/api/overrides");
  return parseJSON<Override[]>(res);
}

export async function putOverride(
  name: string,
  override: Override,
): Promise<Override> {
  const res = await fetch(`/api/overrides/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(override),
  });
  return parseJSON<Override>(res);
}

export async function deleteOverride(name: string): Promise<void> {
  const res = await fetch(`/api/overrides/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  await parseJSON<void>(res);
}

export async function renameOverride(
  name: string,
  next: string,
): Promise<Override> {
  const res = await fetch(
    `/api/overrides/${encodeURIComponent(name)}/rename`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    },
  );
  return parseJSON<Override>(res);
}

export async function getHosts(): Promise<HostsFile[]> {
  const res = await fetch("/api/hosts");
  return parseJSON<HostsFile[]>(res);
}

export async function putHosts(
  name: string,
  hosts: HostsFile,
): Promise<HostsFile> {
  const res = await fetch(`/api/hosts/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hosts),
  });
  return parseJSON<HostsFile>(res);
}

export async function deleteHosts(name: string): Promise<void> {
  const res = await fetch(`/api/hosts/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  await parseJSON<void>(res);
}

export async function renameHosts(
  name: string,
  next: string,
): Promise<HostsFile> {
  const res = await fetch(
    `/api/hosts/${encodeURIComponent(name)}/rename`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    },
  );
  return parseJSON<HostsFile>(res);
}

export async function getLocal(): Promise<LocalConfig> {
  const res = await fetch("/api/local");
  return parseJSON<LocalConfig>(res);
}

export async function putLocal(local: LocalConfig): Promise<LocalConfig> {
  const res = await fetch("/api/local", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(local),
  });
  return parseJSON<LocalConfig>(res);
}

export async function execute(
  request: HttpRequest,
  requestPath?: string,
  id?: string,
): Promise<{ id: string; result: Result }> {
  const execId = id ?? newId();
  const payload: ExecutePayload = {
    id: execId,
    request,
  };
  if (requestPath !== undefined) {
    payload.requestPath = requestPath;
  }
  const res = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await parseJSON<Result>(res);
  return { id: execId, result };
}

export async function cancelExecute(id: string): Promise<{ ok: string }> {
  const res = await fetch(`/api/execute/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseJSON<{ ok: string }>(res);
}

export async function listHistory(limit?: number): Promise<HistoryEntry[]> {
  const qs =
    limit === undefined ? "" : `?limit=${encodeURIComponent(String(limit))}`;
  const res = await fetch(`/api/history${qs}`);
  return parseJSON<HistoryEntry[]>(res);
}

export async function getHistory(id: string): Promise<HistoryEntry> {
  const res = await fetch(`/api/history/${encodeURIComponent(id)}`);
  return parseJSON<HistoryEntry>(res);
}
