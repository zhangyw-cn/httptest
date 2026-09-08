import { SETTINGS_CATEGORIES, type SettingsCategory } from "./settings";

interface Props {
  category: SettingsCategory;
  onSelect: (id: SettingsCategory) => void;
}

export default function SettingsSidebar({ category, onSelect }: Props) {
  return (
    <aside className="sidebar" aria-label="设置分类">
      <div className="sidebar-head">
        <span>设置</span>
      </div>
      <div className="sidebar-body">
        <ul className="req-list">
          {SETTINGS_CATEGORIES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={
                  category === item.id ? "req-item active" : "req-item"
                }
                onClick={() => onSelect(item.id)}
              >
                <span className="req-path">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
