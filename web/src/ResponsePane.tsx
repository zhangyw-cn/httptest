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

export default function ResponsePane({ result }: Props) {
  const [tab, setTab] = useState<"body" | "headers" | "raw" | "timeline">(
    "body",
  );

  if (!result) {
    return (
      <section className="response">
        <div className="response-empty">发送请求后在此查看响应</div>
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
            <span>{result.timings.totalMs} ms</span>
            <span>
              {sizeLabel(result.responseSize)}
              {result.truncated ? "（截断）" : ""}
            </span>
            {result.errorMessage ? (
              <div className="error">{result.errorMessage}</div>
            ) : null}
          </>
        ) : (
          <div className="error">
            <strong>{result.errorClass || "error"}</strong>
            {result.errorMessage ? <div>{result.errorMessage}</div> : null}
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
              <li>dnsMs: {result.timings.dnsMs}</li>
              <li>connectMs: {result.timings.connectMs}</li>
              <li>tlsMs: {result.timings.tlsMs}</li>
              <li>firstByteMs: {result.timings.firstByteMs}</li>
              <li>totalMs: {result.timings.totalMs}</li>
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
