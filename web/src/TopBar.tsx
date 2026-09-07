import type { ThemePref } from "./theme";
import type { Environment, LocalConfig, Override } from "./types";

interface Props {
  workdir: string;
  envs: Environment[];
  overrides: Override[];
  local: LocalConfig | null;
  theme: ThemePref;
  onThemeChange: (theme: ThemePref) => void;
  onEnvChange: (environment: string) => void;
  onOverrideChange: (override: string) => void;
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "系统" },
];

export default function TopBar({
  workdir,
  envs,
  overrides,
  local,
  theme,
  onThemeChange,
  onEnvChange,
  onOverrideChange,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="brand">httptest</h1>
        <span className="cwd" title={workdir}>
          {workdir || "…"}
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
        <label className="env-label">
          覆盖
          <select
            value={local?.override ?? ""}
            onChange={(e) => onOverrideChange(e.target.value)}
          >
            <option value="">无</option>
            {overrides.map((override) => (
              <option key={override.name} value={override.name}>
                {override.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
