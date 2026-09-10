import { useState } from "react";
import {
  msLabel,
  prettyBody,
  rawCombinedDump,
  sizeLabel,
} from "./result-pane";
import type { Result } from "./types";

interface Props {
  result: Result | null;
}

type PrimaryTab = "request" | "response" | "raw";
type ResponseTab = "body" | "headers" | "timeline";

export default function ResultPane({ result }: Props) {
  const [primary, setPrimary] = useState<PrimaryTab>("response");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");

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
          onClick={() => setPrimary("request")}
        >
          Request
        </button>
        <button
          type="button"
          className={primary === "response" ? "tab active" : "tab"}
          onClick={() => setPrimary("response")}
        >
          Response
        </button>
        <button
          type="button"
          className={primary === "raw" ? "tab active" : "tab"}
          onClick={() => setPrimary("raw")}
        >
          Raw
        </button>
      </div>

      <div className="response-body">
        {primary === "request" && (
          <p className="muted">Request 内容见后续任务</p>
        )}

        {primary === "response" && (
          <>
            <div className="tabs tabs-secondary">
              <button
                type="button"
                className={responseTab === "body" ? "tab active" : "tab"}
                onClick={() => setResponseTab("body")}
              >
                Body
              </button>
              <button
                type="button"
                className={
                  responseTab === "headers" ? "tab active" : "tab"
                }
                onClick={() => setResponseTab("headers")}
              >
                Headers
              </button>
              <button
                type="button"
                className={
                  responseTab === "timeline" ? "tab active" : "tab"
                }
                onClick={() => setResponseTab("timeline")}
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
