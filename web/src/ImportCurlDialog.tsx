import { useState } from "react";
import { parseCurl, type ParsedCurlRequest } from "./curl";

interface Props {
  onApply: (parsed: ParsedCurlRequest) => void;
  onClose: () => void;
}

export default function ImportCurlDialog({ onApply, onClose }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const result = parseCurl(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onApply(result.request);
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog import-curl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-curl-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-curl-title">导入 curl</h2>
        <textarea
          className="curl-import-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={12}
          spellCheck={false}
          placeholder="粘贴 curl 命令…"
        />
        {error ? <p className="error">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={apply}>
            应用
          </button>
        </div>
      </div>
    </div>
  );
}
