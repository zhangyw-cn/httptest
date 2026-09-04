import type { LeftView } from "./activity";

interface Props {
  view: LeftView;
  panelOpen: boolean;
  onClickIcon: (view: LeftView) => void;
}

export default function ActivityBar({ view, panelOpen, onClickIcon }: Props) {
  return (
    <nav className="activity" aria-label="侧栏">
      <button
        type="button"
        className={
          view === "collection" && panelOpen
            ? "activity-btn active"
            : "activity-btn"
        }
        title="集合 (Ctrl+B)"
        aria-label="集合"
        aria-pressed={view === "collection" && panelOpen}
        onClick={() => onClickIcon("collection")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5h6.2L17.5 8.8V19.5H7z" />
          <path d="M13.2 4.5V8.8H17.5" />
          <path d="M9.2 12.2h6M9.2 15.2h6" />
        </svg>
      </button>
      <button
        type="button"
        className={
          view === "history" && panelOpen
            ? "activity-btn active"
            : "activity-btn"
        }
        title="历史"
        aria-label="历史"
        aria-pressed={view === "history" && panelOpen}
        onClick={() => onClickIcon("history")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="13" r="6.2" />
          <path d="M12 10.2V13l2 1.4M8.2 5.2 6.5 7.2l2.2 1" />
        </svg>
      </button>
    </nav>
  );
}
