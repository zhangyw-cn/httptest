import type { ReactElement } from "react";
import type { LeftView } from "./activity";
import {
  ACTIVITY_LABEL,
  ACTIVITY_VIEWS,
  isActivityPressed,
} from "./activity";

interface Props {
  view: LeftView;
  panelOpen: boolean;
  onClickIcon: (view: LeftView) => void;
}

const ACTIVITY_TITLE: Record<LeftView, string> = {
  collection: "集合 (Ctrl+B)",
  history: "历史",
  environment: "环境",
  override: "覆盖",
};

const ACTIVITY_ICON: Record<LeftView, ReactElement> = {
  collection: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5h6.2L17.5 8.8V19.5H7z" />
      <path d="M13.2 4.5V8.8H17.5" />
      <path d="M9.2 12.2h6M9.2 15.2h6" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="13" r="6.2" />
      <path d="M12 10.2V13l2 1.4M8.2 5.2 6.5 7.2l2.2 1" />
    </svg>
  ),
  environment: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.8 8.2h14.4v11.3H4.8z" />
      <path d="M8.2 8.2V5.8h7.6v2.4" />
      <path d="M4.8 12.8h14.4" />
    </svg>
  ),
  override: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.5h14v11H5z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  ),
};

export default function ActivityBar({ view, panelOpen, onClickIcon }: Props) {
  return (
    <nav className="activity" aria-label="侧栏">
      {ACTIVITY_VIEWS.map((item) => (
        <button
          key={item}
          type="button"
          className={
            isActivityPressed(view, panelOpen, item)
              ? "activity-btn active"
              : "activity-btn"
          }
          title={ACTIVITY_TITLE[item]}
          aria-label={ACTIVITY_LABEL[item]}
          aria-pressed={isActivityPressed(view, panelOpen, item)}
          onClick={() => onClickIcon(item)}
        >
          {ACTIVITY_ICON[item]}
        </button>
      ))}
    </nav>
  );
}
