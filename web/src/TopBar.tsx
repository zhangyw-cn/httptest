import { useEffect, useRef, useState } from "react";
import { secretsJSON } from "./secrets";
import type { ThemePref } from "./theme";
import type { Environment, LocalConfig } from "./types";

interface Props {
  cwd: string;
  envs: Environment[];
  local: LocalConfig | null;
  theme: ThemePref;
  onThemeChange: (theme: ThemePref) => void;
  onEnvChange: (environment: string) => void;
  onSecretsChange: (secrets: Record<string, string>) => void;
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "系统" },
];

interface Pair {
  id: number;
  key: string;
  value: string;
}

let pairSeq = 0;
function nextPairId(): number {
  pairSeq += 1;
  return pairSeq;
}

function secretsToPairs(secrets: Record<string, string>): Pair[] {
  const rows = Object.entries(secrets).map(([key, value]) => ({
    id: nextPairId(),
    key,
    value,
  }));
  return rows.length > 0 ? rows : [{ id: nextPairId(), key: "", value: "" }];
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
  theme,
  onThemeChange,
  onEnvChange,
  onSecretsChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pairs, setPairs] = useState<Pair[]>(() =>
    secretsToPairs(local?.secrets ?? {}),
  );
  const lastJSON = useRef(secretsJSON(local?.secrets));
  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;
  const secretsJ = secretsJSON(local?.secrets);

  useEffect(() => {
    if (secretsJ !== lastJSON.current) {
      setPairs(secretsToPairs(local?.secrets ?? {}));
      lastJSON.current = secretsJ;
    }
  }, [secretsJ, local?.secrets]);

  function commit(next: Pair[]) {
    setPairs(next);
    pairsRef.current = next;
    const secrets = pairsToSecrets(next);
    lastJSON.current = secretsJSON(secrets);
    onSecretsChange(secrets);
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
        <div className="theme-switch" role="group" aria-label="主题">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={theme === opt.value ? "btn btn-active" : "btn"}
              onClick={() => onThemeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
                <tr key={p.id}>
                  <td>
                    <input
                      value={p.key}
                      onChange={(e) => {
                        const next = pairs.map((row, j) =>
                          j === i ? { ...row, key: e.target.value } : row,
                        );
                        setPairs(next);
                      }}
                      onBlur={() => commit(pairsRef.current)}
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
                      onBlur={() => commit(pairsRef.current)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => {
                        const next = pairs.filter((_, j) => j !== i);
                        commit(next.length ? next : [{ id: nextPairId(), key: "", value: "" }]);
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
            onClick={() =>
              setPairs([...pairs, { id: nextPairId(), key: "", value: "" }])
            }
          >
            添加密钥
          </button>
        </div>
      )}
    </header>
  );
}
