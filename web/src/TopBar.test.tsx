import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import TopBar from "./TopBar";

describe("TopBar", () => {
  it("shows the active override when its file is missing", () => {
    const markup = renderToStaticMarkup(
      <TopBar
        workdir="/tmp/project"
        envs={[]}
        overrides={[]}
        local={{ environment: "", override: "dev", hosts: "" }}
        onEnvChange={vi.fn()}
        onOverrideChange={vi.fn()}
      />,
    );

    expect(markup).toContain('value="dev"');
    expect(markup).toContain("dev（文件缺失）");
    expect(markup).not.toContain("浅色");
  });
});
