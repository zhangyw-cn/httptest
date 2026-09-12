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
        hosts={[]}
        local={{ environment: "", override: "dev", hosts: "" }}
        onEnvChange={vi.fn()}
        onOverrideChange={vi.fn()}
        onHostsChange={vi.fn()}
      />,
    );

    expect(markup).toContain('value="dev"');
    expect(markup).toContain("dev（文件缺失）");
    expect(markup).not.toContain("浅色");
  });

  it("shows Hosts selector with 无 and missing file", () => {
    const markup = renderToStaticMarkup(
      <TopBar
        workdir="/tmp/project"
        envs={[]}
        overrides={[]}
        hosts={[]}
        local={{ environment: "", override: "", hosts: "lan" }}
        onEnvChange={vi.fn()}
        onOverrideChange={vi.fn()}
        onHostsChange={vi.fn()}
      />,
    );
    expect(markup).toContain("Hosts");
    expect(markup).toContain("无");
    expect(markup).toContain("lan（文件缺失）");
  });
});
