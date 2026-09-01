import { useEffect, useState } from "react";
import type { Environment, LocalConfig } from "./types";

interface Props {
  cwd: string;
  envs: Environment[];
  local: LocalConfig | null;
  onEnvChange: (environment: string) => void;
  onSecretsChange: (secrets: Record<string, string>) => void;
}

interface Pair {
  key: string;
  value: string;
}

function secretsToPairs(secrets: Record<string, string>): Pair[] {
  const rows = Object.entries(secrets).map(([key, value]) => ({ key, value }));
  return rows.length > 0 ? rows : [{ key: "", value: "" }];
}

function pairsToSecrets(pairs: Pair[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pairs) {
    if (p.key) out[p.key] = p.value;
  }
  return out;
}

export default function TopBar({
  cwd,
  envs,
  local,
  onEnvChange,
  onSecretsChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pairs, setPairs] = useState<Pair[]>([{ key: "", value: "" }]);

  useEffect(() => {
    setPairs(secretsToPairs(local?.secrets ?? {}));
  }, [local]);

  function commit(next: Pair[]) {
    setPairs(next);
    onSecretsChange(pairsToSecrets(next));
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="brand">httptest</h1>
        <span className="cwd" title={cwd}>
          {cwd || "…"}
        </span>
      </div>
      <div className="topbar-right">
        <label className="env-label">
          环境
          <select
            value={local?.environment ?? ""}
            onChange={(e) => onEnvChange(e.target.value)}
          >
            <option value="">（未选择）</option>
            {envs.map((env) => (
              <option key={env.name} value={env.name}>
                {env.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={open ? "btn btn-active" : "btn"}
          onClick={() => setOpen((v) => !v)}
        >
          密钥
        </button>
      </div>
      {open && (
        <div className="secrets-panel">
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
                      onChange={(e) => {
                        const next = pairs.map((row, j) =>
                          j === i ? { ...row, key: e.target.value } : row,
                        );
                        setPairs(next);
                      }}
                      onBlur={() => commit(pairs)}
                    />
                  </td>
                  <td>
                    <input
                      type="password"
                      value={p.value}
                      onChange={(e) => {
                        const next = pairs.map((row, j) =>
                          j === i ? { ...row, value: e.target.value } : row,
                        );
                        setPairs(next);
                      }}
                      onBlur={() => commit(pairs)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => {
                        const next = pairs.filter((_, j) => j !== i);
                        commit(next.length ? next : [{ key: "", value: "" }]);
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
            onClick={() => setPairs([...pairs, { key: "", value: "" }])}
          >
            添加密钥
          </button>
        </div>
      )}
    </header>
  );
}
