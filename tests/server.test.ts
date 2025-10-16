import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";
import type { PrioritizeInput } from "../src/tools/prioritize.js";

describe("buildServer", () => {
  it("registers core tools with the MCP server stub", async () => {
    const server = await buildServer();
    const toolNames = Array.from(server.tools.keys());

    expect(toolNames).toEqual([
      "hypothesis/propose",
      "test/plan",
      "test/prioritize",
      "conclusion/finalize",
    ]);

    const prioritizeTool = server.tools.get("test/prioritize");
    expect(prioritizeTool).toBeDefined();

    const input: PrioritizeInput = {
      strategy: "RICE",
      items: [
        { id: "a", reach: 10, impact: 2, confidence: 0.5, effort: 5 },
        { id: "b", reach: 30, impact: 5, confidence: 0.9, effort: 8 },
        { id: "c", reach: 5, impact: 3, confidence: 0.7, effort: 2 },
      ],
    };

    const output = await prioritizeTool!.handler(input);
    expect(output.ranked).toHaveLength(3);
    expect(output.ranked[0].rank).toBe(1);
    expect(output.ranked[0].score).toBeGreaterThan(output.ranked[1].score);
  });

  it("start() resolves successfully via the MCP server stub", async () => {
    const server = await buildServer();
    await expect(server.start()).resolves.toBeUndefined();
  });
});
