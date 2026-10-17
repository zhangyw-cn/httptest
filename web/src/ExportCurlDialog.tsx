import { useState } from "react";
import {
  defaultCurlOptions,
  effectiveCurlOptions,
  explainCurl,
  formatCurl,
} from "./curl";
import { notifyError, notifyInfo } from "./toast";
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
  const [options, setOptions] = useState(defaultCurlOptions(prepared.settings));
  const [showExplain, setShowExplain] = useState(false);

  const effectiveOptions = effectiveCurlOptions(options, resolve);
  const commandInput = {
    prepared,
    resolve,
    timeoutSeconds,
    options: effectiveOptions,
  };
  const preview = formatCurl(commandInput);
  const explanations = explainCurl(commandInput);

  async function copyToClipboard() {
    if (!navigator.clipboard?.writeText) {
      notifyError("复制失败");
      return;
    }
    try {
      await navigator.clipboard.writeText(preview);
      notifyInfo("已复制");
      onClose();
    } catch {
      notifyError("复制失败");
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className={
          showExplain
            ? "dialog export-curl-dialog with-explain"
            : "dialog export-curl-dialog"
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-curl-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-curl-title">导出 curl</h2>
        <div className="curl-export-body">
          <fieldset className="curl-options" aria-label="功能选项">
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
                checked={options.maxRedirects}
                disabled={!options.followRedirects}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    maxRedirects: e.target.checked,
                  }))
                }
              />
              限制最大重定向
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
            <label className="curl-option">
              <input
                type="checkbox"
                checked={options.insecure}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    insecure: e.target.checked,
                  }))
                }
              />
              跳过 TLS 校验
            </label>
          </fieldset>
          <div className="curl-export-preview">
            <div className="curl-export-preview-head">
              <h3>预览</h3>
              <button
                type="button"
                className="btn curl-explain-toggle"
                aria-pressed={showExplain}
                onClick={() => setShowExplain((open) => !open)}
              >
                说明
              </button>
            </div>
            <pre className="curl-preview">{preview}</pre>
          </div>
          {showExplain ? (
            <section
              className="curl-export-explain"
              id="export-curl-explain"
              aria-labelledby="export-curl-explain-title"
            >
              <h3 id="export-curl-explain-title">说明</h3>
              <ul className="curl-explain-list">
                {explanations.map((item, index) => (
                  <li key={`${index}-${item.text}`}>
                    <div className="curl-explain-text">{item.text}</div>
                    <p className="curl-explain-detail">{item.explanation}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void copyToClipboard()}
          >
            复制到剪贴板
          </button>
        </div>
      </div>
    </div>
  );
}
