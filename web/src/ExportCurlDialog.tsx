import { useState } from "react";
import { defaultCurlOptions, formatCurl } from "./curl";
import type { HttpRequest, ResolveSpec } from "./types";

interface Props {
  prepared: HttpRequest;
  resolve?: ResolveSpec;
  timeoutSeconds: number;
  onClose: () => void;
}

export default function ExportCurlDialog({
  prepared,
  resolve,
  timeoutSeconds,
  onClose,
}: Props) {
  const [options, setOptions] = useState(defaultCurlOptions());
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const effectiveOptions = {
    ...options,
    useResolve: options.useResolve && !!resolve,
  };

  const preview = formatCurl({
    prepared,
    resolve,
    timeoutSeconds,
    options: effectiveOptions,
  });

  async function copyToClipboard() {
    if (!navigator.clipboard?.writeText) {
      setCopyError("复制失败");
      return;
    }
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setCopyError(null);
      window.setTimeout(() => onClose(), 600);
    } catch {
      setCopyError("复制失败");
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog export-curl-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-curl-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-curl-title">导出 curl</h2>
        <fieldset className="curl-options">
          <legend className="curl-options-legend">功能选项</legend>
          <label className="curl-option">
            <input
              type="checkbox"
              checked={effectiveOptions.useResolve}
              disabled={!resolve}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  useResolve: e.target.checked,
                }))
              }
            />
            使用当前 Hosts 解析
          </label>
          {!resolve ? (
            <p className="curl-option-hint muted">当前 Hosts 未命中此主机</p>
          ) : null}
          <label className="curl-option">
            <input
              type="checkbox"
              checked={options.followRedirects}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  followRedirects: e.target.checked,
                }))
              }
            />
            跟随重定向
          </label>
          <label className="curl-option">
            <input
              type="checkbox"
              checked={options.maxTime}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, maxTime: e.target.checked }))
              }
            />
            限制超时
          </label>
          <p className="curl-option-hint muted">
            使用请求 timeout（默认 30s）
          </p>
        </fieldset>
        <pre className="curl-preview">{preview}</pre>
        {copyError ? <p className="error">{copyError}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void copyToClipboard()}
          >
            {copied ? "已复制" : "复制到剪贴板"}
          </button>
        </div>
      </div>
    </div>
  );
}
