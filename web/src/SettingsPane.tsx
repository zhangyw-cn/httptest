import type { SettingsCategory } from "./settings";
import type { ThemePref } from "./theme";

interface Props {
  category: SettingsCategory;
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
  if (category === "appearance") {
    return (
      <div className="settings-pane">
        <p className="settings-title">外观</p>
        <fieldset className="settings-section">
          <legend className="settings-label">主题</legend>
          <div className="theme-switch" role="radiogroup" aria-label="主题">
            {THEME_OPTIONS.map((opt) => {
              const checked = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={checked ? "btn btn-active" : "btn"}
                  onClick={() => onThemeChange(opt.value)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    );
  }

  const _exhaustive: never = category;
  void _exhaustive;
  return (
    <div className="settings-pane">
      <div className="empty-state">
        <p className="empty-title">未知分类</p>
        <p className="empty-hint">请从左侧选择一个设置分类。</p>
      </div>
    </div>
  );
}
