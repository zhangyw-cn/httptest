export type LeftView =
  | "collection"
  | "history"
  | "environment"
  | "override"
  | "settings";

export const ACTIVITY_VIEWS: readonly LeftView[] = [
  "collection",
  "history",
  "environment",
  "override",
];

export const ACTIVITY_LABEL: Record<LeftView, string> = {
  collection: "集合",
  history: "历史",
  environment: "环境",
  override: "覆盖",
  settings: "设置",
};

export interface LeftState {
  view: LeftView;
  panelOpen: boolean;
}

export function isActivityPressed(
  currentView: LeftView,
  panelOpen: boolean,
  buttonView: LeftView,
): boolean {
  return currentView === buttonView && panelOpen;
}

export function clickActivityIcon(state: LeftState, icon: LeftView): LeftState {
  if (icon === state.view) {
    return { view: state.view, panelOpen: !state.panelOpen };
  }
  return { view: icon, panelOpen: true };
}

export function togglePanel(state: LeftState): LeftState {
  return { ...state, panelOpen: !state.panelOpen };
}
