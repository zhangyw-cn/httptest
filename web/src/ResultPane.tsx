import { useState } from "react";
import { methodClass } from "./method";
import {
  defaultResultTabs,
  msLabel,
  normalizePrepared,
  prettyBody,
  rawCombinedDump,
  sizeLabel,
  type PrimaryTab,
  type RequestTab,
  type ResponseTab,
  type ResultTabs,
} from "./result-pane";
import type { HttpRequest, Result } from "./types";

interface Props {
  result: Result | null;
}

function ReadonlyPairs({
  record,
}: {
  record: Record<string, string>;
}) {
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return <p className="muted">无</p>;
  }
  return (
    <table className="kv-table">
      <thead>
        <tr>
          <th>键</th>
          <th>值</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value], i) => (
          <tr key={`${i}:${key}`}>
            <td>{key}</td>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RequestResult({
  prepared,
  requestSize,
  resolvedIP,
  tab,
  onTabChange,
}: {
  prepared: HttpRequest | null | undefined;
  requestSize: number;
  resolvedIP?: string;
  tab: RequestTab;
  onTabChange: (tab: RequestTab) => void;
}) {
  const req = normalizePrepared(prepared);

  return (
    <div className="request-result">
      <div className="tabs tabs-secondary">
        <button
          type="button"
          className={tab === "overview" ? "tab active" : "tab"}
          onClick={() => onTabChange("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={tab === "query" ? "tab active" : "tab"}
          onClick={() => onTabChange("query")}
        >
          Query
        </button>
        <button
          type="button"
          className={tab === "headers" ? "tab active" : "tab"}
          onClick={() => onTabChange("headers")}
        >
          Headers
        </button>
        <button
          type="button"
          className={tab === "body" ? "tab active" : "tab"}
          onClick={() => onTabChange("body")}
        >
          Body
        </button>
      </div>

      {tab === "overview" && (
        <div className="request-overview">
          <div className="request-overview-line">
            <span className={`method method-${methodClass(req.method)}`}>
              {req.method || "—"}
            </span>{" "}
            <span className="request-overview-url">{req.url || "—"}</span>
          </div>
          <div>请求 {sizeLabel(requestSize)}</div>
          {resolvedIP ? <div>拨号 IP {resolvedIP}</div> : null}
          <p className="muted">变量已展开</p>
        </div>
      )}

      {tab === "query" && <ReadonlyPairs record={req.query} />}
      {tab === "headers" && <ReadonlyPairs record={req.headers} />}

      {tab === "body" && (
        <div className="request-body-view">
          <p className="muted">类型：{req.body.type}</p>
          {req.body.type === "none" && <p className="muted">无正文</p>}
          {req.body.type === "json" && (
            <pre className="dump">
              {prettyBody(
                typeof req.body.content === "string"
                  ? req.body.content
                  : JSON.stringify(req.body.content ?? {}),
              )}
            </pre>
          )}
          {req.body.type === "raw" && (
            <pre className="dump">
              {typeof req.body.content === "string" ? req.body.content : ""}
            </pre>
          )}
          {req.body.type === "form" && (
            <ReadonlyPairs
              record={
                req.body.content && typeof req.body.content === "object"
                  ? req.body.content
                  : {}
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Presentational shell — tabs come from props so SSR tests can select Raw / Request. */
export function ResultPaneContent({
  result,
  tabs,
  onPrimary,
  onRequestTab,
  onResponseTab,
}: {
  result: Result;
  tabs: ResultTabs;
  onPrimary: (tab: PrimaryTab) => void;
  onRequestTab: (tab: RequestTab) => void;
  onResponseTab: (tab: ResponseTab) => void;
}) {
  const { primary, requestTab, responseTab } = tabs;
  const isHttp = result.errorClass === "http";

  return (
    <section
      className={isHttp ? "response" : "response response-error-state"}
    >
      <div className="response-meta">
        {isHttp ? (
          <>
            <span
              className={`status status-${Math.floor(result.status / 100)}xx`}
            >
              {result.status} {result.statusText}
            </span>
            <span>{msLabel(result.timings.totalMs)} ms</span>
            <span title="响应线上字节（解压前）">
              响应 {sizeLabel(result.responseSize)}
              {result.body.length !== result.responseSize
                ? ` · 正文 ${sizeLabel(result.body.length)}`
                : ""}
              {result.truncated ? "（截断）" : ""}
            </span>
            {result.errorMessage ? (
              <div className="error">{result.errorMessage}</div>
            ) : null}
            {result.historyError ? (
              <div className="error">
                历史记录未写入：{result.historyError}
              </div>
            ) : null}
          </>
        ) : (
          <div className="error">
            <strong>{result.errorClass || "error"}</strong>
            {result.errorMessage ? <div>{result.errorMessage}</div> : null}
            {result.historyError ? (
              <div>历史记录未写入：{result.historyError}</div>
            ) : null}
            {result.missingVars && result.missingVars.length > 0 ? (
              <div>缺少变量：{result.missingVars.join(", ")}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          type="button"
          className={primary === "request" ? "tab active" : "tab"}
          onClick={() => onPrimary("request")}
        >
          Request
        </button>
        <button
          type="button"
          className={primary === "response" ? "tab active" : "tab"}
          onClick={() => onPrimary("response")}
        >
          Response
        </button>
        <button
          type="button"
          className={primary === "raw" ? "tab active" : "tab"}
          onClick={() => onPrimary("raw")}
        >
          Raw
        </button>
      </div>

      <div className="response-body">
        {primary === "request" && (
          <RequestResult
            prepared={result.prepared}
            requestSize={result.requestSize ?? 0}
            resolvedIP={result.resolvedIP}
            tab={requestTab}
            onTabChange={onRequestTab}
          />
        )}

        {primary === "response" && (
          <>
            <div className="tabs tabs-secondary">
              <button
                type="button"
                className={responseTab === "body" ? "tab active" : "tab"}
                onClick={() => onResponseTab("body")}
              >
                Body
              </button>
              <button
                type="button"
                className={
                  responseTab === "headers" ? "tab active" : "tab"
                }
                onClick={() => onResponseTab("headers")}
              >
                Headers
              </button>
              <button
                type="button"
                className={
                  responseTab === "timeline" ? "tab active" : "tab"
                }
                onClick={() => onResponseTab("timeline")}
              >
                Timeline
              </button>
            </div>
            {responseTab === "body" && (
              <pre className="dump">{prettyBody(result.body)}</pre>
            )}
            {responseTab === "headers" && (
              <pre className="dump">
                {Object.entries(result.headers ?? {})
                  .map(
                    ([k, v]) =>
                      `${k}: ${Array.isArray(v) ? v.join(", ") : v}`,
                  )
                  .join("\n")}
              </pre>
            )}
            {responseTab === "timeline" && (
              <div className="timeline">
                <ul className="timing-list">
                  <li>dnsMs: {msLabel(result.timings.dnsMs)}</li>
                  <li>connectMs: {msLabel(result.timings.connectMs)}</li>
                  <li>tlsMs: {msLabel(result.timings.tlsMs)}</li>
                  <li>
                    firstByteMs: {msLabel(result.timings.firstByteMs)}
                  </li>
                  <li>totalMs: {msLabel(result.timings.totalMs)}</li>
                </ul>
                <h3>redirects</h3>
                {(result.redirects ?? []).length === 0 ? (
                  <p className="muted">无重定向</p>
                ) : (
                  <ol>
                    {result.redirects.map((h, i) => (
                      <li key={i}>
                        {h.status} {h.url} → {h.location}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}

        {primary === "raw" && (
          <pre className="dump">
            {rawCombinedDump(result.requestDump, result.responseDump)}
          </pre>
        )}
      </div>
    </section>
  );
}

export default function ResultPane({ result }: Props) {
  const [tabs, setTabs] = useState<ResultTabs>(defaultResultTabs);

  if (!result) {
    return (
      <section className="response">
        <div className="empty-state">
          <p className="empty-title">还没有响应</p>
          <p className="empty-hint">填 URL，按 Send 或 Ctrl+Enter</p>
        </div>
      </section>
    );
  }

  return (
    <ResultPaneContent
      result={result}
      tabs={tabs}
      onPrimary={(primary) => setTabs((t) => ({ ...t, primary }))}
      onRequestTab={(requestTab) => setTabs((t) => ({ ...t, requestTab }))}
      onResponseTab={(responseTab) => setTabs((t) => ({ ...t, responseTab }))}
    />
  );
}
