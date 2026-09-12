import type { Environment, HostsFile, LocalConfig, Override } from "./types";

interface Props {
  workdir: string;
  envs: Environment[];
  overrides: Override[];
  hosts: HostsFile[];
  local: LocalConfig | null;
  onEnvChange: (environment: string) => void;
  onOverrideChange: (override: string) => void;
  onHostsChange: (hosts: string) => void;
}

export default function TopBar({
  workdir,
  envs,
  overrides,
  hosts,
  local,
  onEnvChange,
  onOverrideChange,
  onHostsChange,
}: Props) {
  const activeOverride = local?.override ?? "";
  const missingOverride =
    activeOverride !== "" &&
    !overrides.some((override) => override.name === activeOverride);
  const activeHosts = local?.hosts ?? "";
  const missingHosts =
    activeHosts !== "" &&
    !hosts.some((item) => item.name === activeHosts);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="brand">httptest</h1>
        <span className="cwd" title={workdir}>
          {workdir || "…"}
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
        <label className="env-label">
          覆盖
          <select
            value={activeOverride}
            onChange={(e) => onOverrideChange(e.target.value)}
          >
            <option value="">无</option>
            {missingOverride && (
              <option value={activeOverride}>
                {activeOverride}（文件缺失）
              </option>
            )}
            {overrides.map((override) => (
              <option key={override.name} value={override.name}>
                {override.name}
              </option>
            ))}
          </select>
        </label>
        <label className="env-label">
          Hosts
          <select
            value={activeHosts}
            onChange={(e) => onHostsChange(e.target.value)}
          >
            <option value="">无</option>
            {missingHosts && (
              <option value={activeHosts}>
                {activeHosts}（文件缺失）
              </option>
            )}
            {hosts.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
