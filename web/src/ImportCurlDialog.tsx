import { useState } from "react";
import { parseCurl, type ParsedCurlRequest, type ParseCurlResult } from "./curl";
import { notifyError } from "./toast";

interface Props {
  onApply: (parsed: ParsedCurlRequest) => void;
  onClose: () => void;
}

/** Parse paste text. The dialog stays open and toasts the error when the result is not ok. */
export function tryApplyImport(text: string): ParseCurlResult {
  return parseCurl(text);
}

export default function ImportCurlDialog({ onApply, onClose }: Props) {
  const [text, setText] = useState("");

  function apply() {
    const result = tryApplyImport(text);
    if (!result.ok) {
      notifyError(result.error);
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
          onChange={(e) => setText(e.target.value)}
          rows={12}
          spellCheck={false}
          placeholder="粘贴 curl 命令…"
        />
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
