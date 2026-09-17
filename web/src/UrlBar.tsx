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
  onImportCurl: () => void;
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
  onImportCurl,
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
      <button
        type="button"
        className="btn btn-primary"
        onClick={onSend}
        disabled={busy}
      >
        Send
      </button>
      <button type="button" className="btn" onClick={onStop} disabled={!sending}>
        Stop
      </button>
      <button type="button" className="btn" onClick={onSave} disabled={saving}>
        保存
      </button>
      <div className="urlbar-more" ref={menuRef}>
        <button
          type="button"
          className="btn urlbar-more-toggle"
          disabled={busy}
          aria-label="更多"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          ⋯
        </button>
        <div
          className={`urlbar-more-panel${menuOpen ? " urlbar-more-panel-open" : ""}`}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              onImportCurl();
              setMenuOpen(false);
            }}
          >
            导入 curl
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              onExportCurl();
              setMenuOpen(false);
            }}
          >
            导出 curl
          </button>
        </div>
      </div>
    </div>
  );
}
