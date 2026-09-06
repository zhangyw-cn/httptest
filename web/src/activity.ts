export type LeftView = "collection" | "history" | "environment";

export interface LeftState {
  view: LeftView;
  panelOpen: boolean;
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
