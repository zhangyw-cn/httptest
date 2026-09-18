import { useEffect, useRef, useState } from "react";
import type { BodyType, HttpRequest, RequestSettings } from "./types";

interface Pair {
  key: string;
  value: string;
}

interface Props {
  draft: HttpRequest;
  onChange: (next: HttpRequest) => void;
}

const BODY_TYPES: BodyType[] = ["none", "json", "raw", "form"];

type EditorTab = "query" | "headers" | "body" | "settings";

function effectiveFollow(s?: RequestSettings): boolean {
  return s?.followRedirects !== false;
}

function effectiveTimeoutMs(s?: RequestSettings): number {
  return s?.timeoutMs ?? 30000;
}

function effectiveMax(s?: RequestSettings): number {
  return s?.maxRedirects ?? 10;
}

function effectiveInsecure(s?: RequestSettings): boolean {
  return s?.insecureSkipVerify === true;
}

function draftSettings(s?: RequestSettings): RequestSettings {
  return {
    timeoutMs: effectiveTimeoutMs(s),
    followRedirects: effectiveFollow(s),
    maxRedirects: effectiveMax(s),
    insecureSkipVerify: effectiveInsecure(s),
  };
}

function recordToPairs(rec: Record<string, string> | undefined): Pair[] {
  const rows = Object.entries(rec ?? {}).map(([key, value]) => ({ key, value }));
  return rows.length > 0 ? rows : [{ key: "", value: "" }];
}

function pairsToRecord(pairs: Pair[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pairs) {
    if (p.key) out[p.key] = p.value;
  }
  return out;
}

function recordJSON(rec: Record<string, string> | undefined): string {
  return JSON.stringify(rec ?? {});
}

function formRecord(
  content: HttpRequest["body"]["content"],
): Record<string, string> {
  if (content && typeof content === "object") return content;
  return {};
}

function PairTable({
  pairs,
  onChange,
}: {
  pairs: Pair[];
  onChange: (next: Pair[]) => void;
}) {
  return (
    <div>
      <table className="kv-table">
        <thead>
          <tr>
            <th>键</th>
            <th>值</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={i}>
              <td>
                <input
                  value={p.key}
                  onChange={(e) =>
                    onChange(
                      pairs.map((row, j) =>
                        j === i ? { ...row, key: e.target.value } : row,
                      ),
                    )
                  }
                />
              </td>
              <td>
                <input
                  value={p.value}
                  onChange={(e) =>
                    onChange(
                      pairs.map((row, j) =>
                        j === i ? { ...row, value: e.target.value } : row,
                      ),
                    )
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => {
                    const next = pairs.filter((_, j) => j !== i);
                    onChange(next.length ? next : [{ key: "", value: "" }]);
                  }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="btn"
        onClick={() => onChange([...pairs, { key: "", value: "" }])}
      >
        添加
      </button>
    </div>
  );
}

export default function RequestEditor({ draft, onChange }: Props) {
  const [tab, setTab] = useState<EditorTab>("body");
  const [queryPairs, setQueryPairs] = useState<Pair[]>(() =>
    recordToPairs(draft.query),
  );
  const [headerPairs, setHeaderPairs] = useState<Pair[]>(() =>
    recordToPairs(draft.headers),
  );
  const [formPairs, setFormPairs] = useState<Pair[]>(() =>
    recordToPairs(formRecord(draft.body.content)),
  );
  const lastQueryJSON = useRef(recordJSON(draft.query));
  const lastHeaderJSON = useRef(recordJSON(draft.headers));
  const lastFormJSON = useRef(recordJSON(formRecord(draft.body.content)));

  const queryJSON = recordJSON(draft.query);
  const headerJSON = recordJSON(draft.headers);
  const formJSON = recordJSON(formRecord(draft.body.content));

  useEffect(() => {
    if (queryJSON !== lastQueryJSON.current) {
      setQueryPairs(recordToPairs(draft.query));
      lastQueryJSON.current = queryJSON;
    }
  }, [queryJSON, draft.query]);

  useEffect(() => {
    if (headerJSON !== lastHeaderJSON.current) {
      setHeaderPairs(recordToPairs(draft.headers));
      lastHeaderJSON.current = headerJSON;
    }
  }, [headerJSON, draft.headers]);

  useEffect(() => {
    if (draft.body.type !== "form") return;
    if (formJSON !== lastFormJSON.current) {
      setFormPairs(recordToPairs(formRecord(draft.body.content)));
      lastFormJSON.current = formJSON;
    }
  }, [formJSON, draft.body.content, draft.body.type]);

  const bodyText =
    typeof draft.body.content === "string" ? draft.body.content : "";

  function commitQuery(pairs: Pair[]) {
    setQueryPairs(pairs);
    const rec = pairsToRecord(pairs);
    lastQueryJSON.current = recordJSON(rec);
    onChange({ ...draft, query: rec });
  }

  function commitHeaders(pairs: Pair[]) {
    setHeaderPairs(pairs);
    const rec = pairsToRecord(pairs);
    lastHeaderJSON.current = recordJSON(rec);
    onChange({ ...draft, headers: rec });
  }

  function commitForm(pairs: Pair[]) {
    setFormPairs(pairs);
    const rec = pairsToRecord(pairs);
    lastFormJSON.current = recordJSON(rec);
    onChange({ ...draft, body: { type: "form", content: rec } });
  }

  function commitSettings(next: RequestSettings) {
    onChange({ ...draft, settings: next });
  }

  function setBodyType(type: BodyType) {
    if (type === "none") {
      onChange({ ...draft, body: { type: "none" } });
      return;
    }
    if (type === "form") {
      const content = formRecord(draft.body.content);
      lastFormJSON.current = recordJSON(content);
      setFormPairs(recordToPairs(content));
      onChange({ ...draft, body: { type, content } });
      return;
    }
    const content =
      typeof draft.body.content === "string" ? draft.body.content : "";
    onChange({ ...draft, body: { type, content } });
  }

  return (
    <section className="editor">
      <div className="tabs">
        <button
          type="button"
          className={tab === "query" ? "tab active" : "tab"}
          onClick={() => setTab("query")}
        >
          Query
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
          className={tab === "body" ? "tab active" : "tab"}
          onClick={() => setTab("body")}
        >
          Body
        </button>
        <button
          type="button"
          className={tab === "settings" ? "tab active" : "tab"}
          onClick={() => setTab("settings")}
        >
          请求设置
        </button>
      </div>
      <div className="editor-body">
        {tab === "query" && (
          <PairTable pairs={queryPairs} onChange={commitQuery} />
        )}
        {tab === "headers" && (
          <PairTable pairs={headerPairs} onChange={commitHeaders} />
        )}
        {tab === "body" && (
          <div className="body-pane">
            <label className="env-label">
              类型
              <select
                value={draft.body.type}
                onChange={(e) => setBodyType(e.target.value as BodyType)}
              >
                {BODY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {draft.body.type === "form" && (
              <PairTable pairs={formPairs} onChange={commitForm} />
            )}
            {(draft.body.type === "json" || draft.body.type === "raw") && (
              <textarea
                className="body-text"
                value={bodyText}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    body: { type: draft.body.type, content: e.target.value },
                  })
                }
                spellCheck={false}
              />
            )}
          </div>
        )}
        <div className="request-settings" hidden={tab !== "settings"}>
          <label className="env-label" htmlFor="request-timeout-ms">
            超时 (ms)
            <input
              id="request-timeout-ms"
              type="number"
              value={effectiveTimeoutMs(draft.settings)}
              onChange={(e) => {
                const next = draftSettings(draft.settings);
                if (e.target.value === "") {
                  delete next.timeoutMs;
                } else {
                  next.timeoutMs = Number(e.target.value);
                }
                commitSettings(next);
              }}
            />
          </label>
          <label className="env-label">
            跟随重定向
            <input
              type="checkbox"
              checked={effectiveFollow(draft.settings)}
              onChange={(e) =>
                commitSettings({
                  ...draftSettings(draft.settings),
                  followRedirects: e.target.checked,
                })
              }
            />
          </label>
          <label className="env-label" htmlFor="request-max-redirects">
            最大重定向次数
            <input
              id="request-max-redirects"
              type="number"
              min={1}
              max={50}
              disabled={!effectiveFollow(draft.settings)}
              value={effectiveMax(draft.settings)}
              onChange={(e) =>
                commitSettings({
                  ...draftSettings(draft.settings),
                  maxRedirects: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="env-label">
            跳过 TLS 校验
            <input
              type="checkbox"
              checked={effectiveInsecure(draft.settings)}
              onChange={(e) =>
                commitSettings({
                  ...draftSettings(draft.settings),
                  insecureSkipVerify: e.target.checked,
                })
              }
            />
            {effectiveInsecure(draft.settings) ? (
              <span className="muted">
                仅用于本机调试，勿对生产证书使用
              </span>
            ) : null}
          </label>
        </div>
      </div>
    </section>
  );
}
