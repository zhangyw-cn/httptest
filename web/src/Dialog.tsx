import { useEffect, useRef, useState } from "react";

export type DialogMode =
  | {
      kind: "path";
      title: string;
      submitLabel: string;
      error: string | null;
      intent:
        | "create"
        | "save"
        | "create-env"
        | "rename-env"
        | "create-override"
        | "rename-override";
      hint?: string;
    }
  | {
      kind: "confirm";
      title: string;
      body: string;
      submitLabel: string;
      error: string | null;
      path: string;
      subject?: "request" | "environment" | "override";
      next?: string;
    };

interface Props {
  mode: DialogMode;
  onClose: () => void;
  onSubmit: (path?: string) => void | Promise<void>;
}

export default function Dialog({ mode, onClose, onSubmit }: Props) {
  const [path, setPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode.kind === "path") inputRef.current?.focus();
    else cancelRef.current?.focus();
  }, [mode.kind]);

  const canSubmitPath = mode.kind === "path" && path.trim().length > 0;

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode.kind === "path") {
        const p = path.trim();
        if (!p) return;
        await onSubmit(p);
        return;
      }
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title">{mode.title}</h2>
        {mode.kind === "path" ? (
          <>
            <p>
              {mode.hint ?? "相对 collections/，例如 auth/ping"}
            </p>
            <input
              ref={inputRef}
              className="dialog-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </>
        ) : (
          <p>{mode.body}</p>
        )}
        {mode.error ? <p className="error">{mode.error}</p> : null}
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className={
              mode.kind === "confirm" ? "btn btn-danger" : "btn btn-primary"
            }
            disabled={submitting || (mode.kind === "path" && !canSubmitPath)}
            onClick={() => void submit()}
          >
            {mode.submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
