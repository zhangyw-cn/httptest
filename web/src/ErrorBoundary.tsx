import { Component, type ErrorInfo, type ReactNode } from "react";
import { notifySticky } from "./toast";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    notifySticky(`界面出错：${error.message}`);
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}
