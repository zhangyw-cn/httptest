interface Props {
  name: string | null;
  hostsType: "hosts";
  content: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  emptyTitle: string;
  onContentChange: (v: string) => void;
  onSave: () => void;
  onRename: () => void;
}

export default function HostsContentEditor({
  name,
  hostsType,
  content,
  dirty,
  saving,
  error,
  emptyTitle,
  onContentChange,
  onSave,
  onRename,
}: Props) {
  if (!name) {
    return (
      <div className="env-editor">
        <div className="empty-state">
          <p className="empty-title">{emptyTitle}</p>
          {error ? <p className="error env-editor-error">{error}</p> : null}
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
        <span className="hosts-type-tag">{hostsType}</span>
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
        <textarea
          className="hosts-content"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
