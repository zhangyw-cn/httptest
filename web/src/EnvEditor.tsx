import { newEnvPair, type EnvPair } from "./env";

interface Props {
  name: string | null;
  pairs: EnvPair[];
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onPairsChange: (next: EnvPair[]) => void;
  onSave: () => void;
  onRename: () => void;
  emptyTitle?: string;
  maskValues?: boolean;
  keyHeader?: string;
  valueHeader?: string;
}

export default function EnvEditor({
  name,
  pairs,
  dirty,
  saving,
  error,
  onPairsChange,
  onSave,
  onRename,
  emptyTitle = "在左侧选择一个环境，或新建",
  maskValues = false,
  keyHeader = "键",
  valueHeader = "值",
}: Props) {
  if (!name) {
    return (
      <div className="env-editor">
        <div className="empty-state">
          <p className="empty-title">{emptyTitle}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="env-editor">
      <div className="urlbar">
        <span className="env-editor-name" title={name}>
          {name}
        </span>
        {dirty && <span className="dirty">未保存</span>}
        <button
          type="button"
          className="btn"
          onClick={onRename}
          disabled={saving}
        >
          改名
        </button>
        <button
          type="button"
          className="btn"
          onClick={onSave}
          disabled={saving || !dirty}
        >
          保存
        </button>
      </div>
      {error ? <p className="error env-editor-error">{error}</p> : null}
      <div className="env-editor-body">
        <table className="kv-table">
          <thead>
            <tr>
              <th>{keyHeader}</th>
              <th>{valueHeader}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pairs.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <input
                    value={p.key}
                    onChange={(e) =>
                      onPairsChange(
                        pairs.map((row, j) =>
                          j === i ? { ...row, key: e.target.value } : row,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type={maskValues ? "password" : "text"}
                    value={p.value}
                    onChange={(e) =>
                      onPairsChange(
                        pairs.map((row, j) =>
                          j === i ? { ...row, value: e.target.value } : row,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => {
                      const next = pairs.filter((_, j) => j !== i);
                      onPairsChange(next.length ? next : [newEnvPair()]);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn"
          onClick={() => onPairsChange([...pairs, newEnvPair()])}
        >
          添加变量
        </button>
      </div>
    </div>
  );
}
