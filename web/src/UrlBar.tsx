import { useEffect, useRef, useState } from "react";
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

/** Menu actions disabled while sending or preparing an export. */
export function sendMenuBusy(sending: boolean, exporting: boolean): boolean {
  return sending || exporting;
}

interface Props {
  draft: HttpRequest;
  dirty: boolean;
  sending: boolean;
  saving: boolean;
  exporting?: boolean;
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
  exporting = false,
  onChange,
  onSend,
  onStop,
  onSave,
  onExportCurl,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const busy = sendMenuBusy(sending, exporting);

  useEffect(() => {
    if (busy) setMenuOpen(false);
  }, [busy]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [menuOpen]);

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
          disabled={busy}
        >
          Send
        </button>
        <div className="send-menu" ref={menuRef}>
          <button
            type="button"
            className="btn btn-primary send-menu-toggle"
            disabled={busy}
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
              disabled={busy}
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
