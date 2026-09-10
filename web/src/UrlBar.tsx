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
}: Props) {
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
        disabled={sending}
      >
        Send
      </button>
      <button type="button" className="btn" onClick={onStop} disabled={!sending}>
        Stop
      </button>
      <button type="button" className="btn" onClick={onSave} disabled={saving}>
        Save
      </button>
    </div>
  );
}
