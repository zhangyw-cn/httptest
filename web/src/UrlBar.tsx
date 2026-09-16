import { useState } from "react";
import { methodClass } from "./method";
import type { HttpRequest } from "./types";

const METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export { methodClass };

interface Props {
  draft: HttpRequest;
  dirty: boolean;
  sending: boolean;
  saving: boolean;
  onChange: (next: HttpRequest) => void;
  onSend: () => void;
  onStop: () => void;
  onSave: () => void;
  onExportCurl: () => void;
}

export default function UrlBar({
  draft,
  dirty,
  sending,
  saving,
  onChange,
  onSend,
  onStop,
  onSave,
  onExportCurl,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  function onExportClick() {
    onExportCurl();
    setMenuOpen(false);
  }

  return (
    <div className="urlbar">
      <select
        className={`method method-${methodClass(draft.method)}`}
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
      <div className="send-split">
        <button
          type="button"
          className="btn btn-primary send-split-main"
          onClick={onSend}
          disabled={sending}
        >
          Send
        </button>
        <div className="send-menu">
          <button
            type="button"
            className="btn btn-primary send-menu-toggle"
            disabled={sending}
            aria-label="Send 菜单"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            ▾
          </button>
          <div
            className={`send-menu-panel${menuOpen ? " send-menu-panel-open" : ""}`}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              disabled={sending}
              onClick={onExportClick}
            >
              导出 curl
            </button>
          </div>
        </div>
      </div>
      <button type="button" className="btn" onClick={onStop} disabled={!sending}>
        Stop
      </button>
      <button type="button" className="btn" onClick={onSave} disabled={saving}>
        保存
      </button>
    </div>
  );
}
