import type { ThemePref } from "./theme";

interface Props {
  category: string;
  theme: ThemePref;
  onThemeChange: (theme: ThemePref) => void;
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "系统" },
];

export default function SettingsPane({
  category,
  theme,
  onThemeChange,
}: Props) {
  if (category !== "appearance") {
    return (
      <div className="settings-pane">
        <div className="empty-state">
          <h2>未知分类</h2>
          <p>请从左侧选择一个设置分类。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-pane">
      <h2 className="settings-title">外观</h2>
      <section className="settings-section">
        <h3 className="settings-label">主题</h3>
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
      </section>
    </div>
  );
}
