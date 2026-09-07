import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import ActivityBar from "./ActivityBar";
import Sidebar from "./Sidebar";

function textOf(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("");
}

function overrideSidebar({
  activeOverride,
  editingOverride,
  onSelectOverride,
}: {
  activeOverride: string;
  editingOverride: string | null;
  onSelectOverride: (name: string) => void;
}): ReactTestRenderer {
  return create(
    <Sidebar
      requests={[]}
      currentPath={null}
      view="override"
      sending={false}
      envs={[]}
      editingEnv={null}
      activeEnv=""
      overrides={[
        { name: "default", variables: {} },
        { name: "debug", variables: {} },
      ]}
      editingOverride={editingOverride}
      activeOverride={activeOverride}
      onSelectRequest={vi.fn()}
      onNewRequest={vi.fn()}
      onDeleteRequest={vi.fn()}
      onSelectHistory={vi.fn()}
      onSelectEnv={vi.fn()}
      onNewEnv={vi.fn()}
      onDeleteEnv={vi.fn()}
      onSelectOverride={onSelectOverride}
      onNewOverride={vi.fn()}
      onDeleteOverride={vi.fn()}
    />,
  );
}

describe("override panel", () => {
  it("exposes all four activity views and routes each button", () => {
    const onClickIcon = vi.fn();
    const tree = create(
      <ActivityBar
        view="override"
        panelOpen
        onClickIcon={onClickIcon}
      />,
    );
    const buttons = tree.root.findAllByType("button");

    expect(buttons.map((button) => button.props["aria-label"])).toEqual([
      "集合",
      "历史",
      "环境",
      "覆盖",
    ]);
    buttons.forEach((button) => button.props.onClick());
    expect(onClickIcon.mock.calls.map(([view]) => view)).toEqual([
      "collection",
      "history",
      "environment",
      "override",
    ]);
    expect(buttons.map((button) => button.props["aria-pressed"])).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("puts the send badge only on activeOverride, not editingOverride", () => {
    const tree = overrideSidebar({
      activeOverride: "default",
      editingOverride: "debug",
      onSelectOverride: vi.fn(),
    });
    const rows = tree.root.findAll(
      (node) =>
        node.type === "button" &&
        typeof node.props.className === "string" &&
        node.props.className.includes("req-item"),
    );

    expect(rows.map(textOf)).toEqual(["default发送", "debug"]);
    expect(rows.map((row) => row.props.className)).toEqual([
      "req-item",
      "req-item active",
    ]);
  });

  it("selects an override row without changing the active send override", () => {
    const onSelectOverride = vi.fn();
    const tree = overrideSidebar({
      activeOverride: "default",
      editingOverride: null,
      onSelectOverride,
    });
    const debugRow = tree.root.findAll(
      (node) =>
        node.type === "button" &&
        typeof node.props.className === "string" &&
        node.props.className.includes("req-item"),
    )[1];

    debugRow.props.onClick();

    expect(onSelectOverride).toHaveBeenCalledOnce();
    expect(onSelectOverride).toHaveBeenCalledWith("debug");
    expect(textOf(debugRow)).toBe("debug");
  });
});
