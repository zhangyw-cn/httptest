export type BodyType = "none" | "json" | "raw" | "form";

export interface RequestBody {
  type: BodyType;
  content?: string | Record<string, string>;
}

export interface HttpRequest {
  name: string;
  method: string;
  url: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: RequestBody;
  timeout?: string;
}

export interface ExecutePayload {
  id: string;
  requestPath?: string;
  request: HttpRequest;
}

export type ErrorClass =
  | "invalid"
  | "canceled"
  | "timeout"
  | "dns"
  | "connect"
  | "tls"
  | "http";

export interface RequestMeta {
  path: string;
  name: string;
}

export interface WorkspaceInfo {
  workdir: string;
  requests: RequestMeta[];
}

export interface Environment {
  name: string;
  variables: Record<string, string>;
}

export interface Override {
  name: string;
  variables: Record<string, string>;
}

export type HostsType = "map" | "hosts";

export interface HostsFile {
  name: string;
  type: HostsType;
  mappings: Record<string, string>;
  content: string;
}

export interface LocalConfig {
  environment: string;
  override: string;
  hosts: string;
}

export interface RedirectHop {
  status: number;
  url: string;
  location: string;
}

export interface Timings {
  dnsMs: number;
  connectMs: number;
  tlsMs: number;
  firstByteMs: number;
  totalMs: number;
}

export interface ResolveSpec {
  host: string;
  port: string;
  ip: string;
}

export interface PrepareResponse {
  prepared: HttpRequest;
  resolve?: ResolveSpec;
  timeoutSeconds?: number;
  errorClass: ErrorClass | "";
  errorMessage: string;
  missingVars?: string[];
}

export interface Result {
  status: number;
  statusText: string;
  headers: Record<string, string[]>;
  body: string;
  truncated: boolean;
  requestDump: string;
  responseDump: string;
  requestSize: number;
  responseSize: number;
  redirects: RedirectHop[];
  timings: Timings;
  errorClass: ErrorClass | "";
  errorMessage: string;
  historyError?: string;
  missingVars?: string[];
  resolvedIP?: string;
  prepared: HttpRequest;
}

export interface HistoryEntry {
  id: string;
  time: string;
  requestPath?: string;
  request: HttpRequest;
  result: Result;
}

export interface CreateRequestBody {
  path: string;
  request: HttpRequest;
}
