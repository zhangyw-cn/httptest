import { useMemo, useState } from "react";
import type { BodyType, HttpRequest } from "./types";

interface Pair {
  key: string;
  value: string;
}

interface Props {
  draft: HttpRequest;
  dirty: boolean;
  sending: boolean;
  saving: boolean;
  onChange: (next: HttpRequest) => void;
  onSend: () => void;
  onStop: () => void;
  onSave: () => void;
}

const METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

const BODY_TYPES: BodyType[] = ["none", "json", "raw", "form"];

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

export default function RequestEditor({
  draft,
  dirty,
  sending,
  saving,
  onChange,
  onSend,
  onStop,
  onSave,
}: Props) {
  const [tab, setTab] = useState<"query" | "headers" | "body">("body");

  const queryPairs = useMemo(() => recordToPairs(draft.query), [draft.query]);
  const headerPairs = useMemo(
    () => recordToPairs(draft.headers),
    [draft.headers],
  );
  const formPairs = useMemo(() => {
    const c = draft.body.content;
    if (c && typeof c === "object") return recordToPairs(c);
    return recordToPairs({});
  }, [draft.body.content]);

  const bodyText =
    typeof draft.body.content === "string" ? draft.body.content : "";

  function setBodyType(type: BodyType) {
    if (type === "none") {
      onChange({ ...draft, body: { type: "none" } });
      return;
    }
    if (type === "form") {
      const content =
        draft.body.content && typeof draft.body.content === "object"
          ? draft.body.content
          : {};
      onChange({ ...draft, body: { type, content } });
      return;
    }
    const content =
      typeof draft.body.content === "string" ? draft.body.content : "";
    onChange({ ...draft, body: { type, content } });
  }

  return (
    <section className="editor">
      <div className="editor-line">
        <select
          className="method"
          value={draft.method}
          onChange={(e) => onChange({ ...draft, method: e.target.value })}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="url"
          value={draft.url}
          onChange={(e) => onChange({ ...draft, url: e.target.value })}
          spellCheck={false}
        />
        {dirty && <span className="dirty">未保存</span>}
      </div>
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
      </div>
      <div className="editor-body">
        {tab === "query" && (
          <PairTable
            pairs={queryPairs}
            onChange={(pairs) =>
              onChange({ ...draft, query: pairsToRecord(pairs) })
            }
          />
        )}
        {tab === "headers" && (
          <PairTable
            pairs={headerPairs}
            onChange={(pairs) =>
              onChange({ ...draft, headers: pairsToRecord(pairs) })
            }
          />
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
              <PairTable
                pairs={formPairs}
                onChange={(pairs) =>
                  onChange({
                    ...draft,
                    body: { type: "form", content: pairsToRecord(pairs) },
                  })
                }
              />
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
      </div>
      <div className="editor-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSend}
          disabled={sending}
        >
          Send
        </button>
        <button
          type="button"
          className="btn"
          onClick={onStop}
          disabled={!sending}
        >
          Stop
        </button>
        <button
          type="button"
          className="btn"
          onClick={onSave}
          disabled={saving}
        >
          Save
        </button>
      </div>
    </section>
  );
}
