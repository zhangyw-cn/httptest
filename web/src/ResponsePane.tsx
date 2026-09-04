import { useState } from "react";
import type { Result } from "./types";

interface Props {
  result: Result | null;
}

function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function sizeLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function msLabel(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 10 || Number.isInteger(n)) return n.toFixed(0);
  return n.toFixed(2);
}

export default function ResponsePane({ result }: Props) {
  const [tab, setTab] = useState<"body" | "headers" | "raw" | "timeline">(
    "body",
  );

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

  const isHttp = result.errorClass === "http";

  return (
    <section
      className={
        isHttp ? "response" : "response response-error-state"
      }
    >
      <div className="response-meta">
        {isHttp ? (
          <>
            <span className={`status status-${Math.floor(result.status / 100)}xx`}>
              {result.status} {result.statusText}
            </span>
            <span>{msLabel(result.timings.totalMs)} ms</span>
            <span title="请求体字节">
              请求 {sizeLabel(result.requestSize ?? 0)}
            </span>
            <span title="响应线上字节（解压前）">
              响应 {sizeLabel(result.responseSize)}
              {result.body &&
              result.body.length !== result.responseSize
                ? ` · 正文 ${sizeLabel(result.body.length)}`
                : ""}
              {result.truncated ? "（截断）" : ""}
            </span>
            {result.errorMessage ? (
              <div className="error">{result.errorMessage}</div>
            ) : null}
            {result.historyError ? (
              <div className="error">历史记录未写入：{result.historyError}</div>
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
          className={tab === "body" ? "tab active" : "tab"}
          onClick={() => setTab("body")}
        >
          Body
        </button>
        <button
          type="button"
          className={tab === "headers" ? "tab active" : "tab"}
          onClick={() => setTab("headers")}
        >
          Headers
        </button>
        <button
          type="button"
          className={tab === "raw" ? "tab active" : "tab"}
          onClick={() => setTab("raw")}
        >
          Raw
        </button>
        <button
          type="button"
          className={tab === "timeline" ? "tab active" : "tab"}
          onClick={() => setTab("timeline")}
        >
          Timeline
        </button>
      </div>
      <div className="response-body">
        {tab === "body" && (
          <pre className="dump">{prettyBody(result.body)}</pre>
        )}
        {tab === "headers" && (
          <pre className="dump">
            {Object.entries(result.headers ?? {})
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("\n")}
          </pre>
        )}
        {tab === "raw" && (
          <pre className="dump">
            {result.requestDump}
            {"\n\n----------\n\n"}
            {result.responseDump}
          </pre>
        )}
        {tab === "timeline" && (
          <div className="timeline">
            <ul className="timing-list">
              <li>dnsMs: {msLabel(result.timings.dnsMs)}</li>
              <li>connectMs: {msLabel(result.timings.connectMs)}</li>
              <li>tlsMs: {msLabel(result.timings.tlsMs)}</li>
              <li>firstByteMs: {msLabel(result.timings.firstByteMs)}</li>
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
      </div>
    </section>
  );
}
