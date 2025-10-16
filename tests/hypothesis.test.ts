import { describe, expect, it, vi } from "vitest";
import { generateHypotheses } from "../src/llm/generator.js";

describe("generateHypotheses", () => {
  it("returns deterministic placeholder hypotheses when no client is provided", async () => {
    const result = await generateHypotheses({
      caseId: "case-123",
      text: "Database latency increases during peaks",
    });

    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("case-123");
    expect(result[0].testPlan.method).toBe("Review telemetry");
  });

  it("parses structured hypotheses emitted by an LLM client", async () => {
    const fakeClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify([
          {
            text: "Connection pool exhausted",
            rationale: "Worker count doubled without increasing pool size.",
            testPlan: {
              method: "Check pg_stat_activity",
              expected: "Active connections near pool max",
              metric: "active_connections",
            },
          },
        ])
      ),
    };

    const result = await generateHypotheses(
      {
        caseId: "case-456",
        text: "API returns 503 intermittently",
        rationale: "Error rate spikes after deploy",
        context: "Service: payments, Region: ap-northeast-1",
        logs: ["503 backend fetch failed"],
      },
      fakeClient
    );

    expect(fakeClient.complete).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      text: "Connection pool exhausted",
      rationale: "Worker count doubled without increasing pool size.",
      testPlan: {
        method: "Check pg_stat_activity",
        expected: "Active connections near pool max",
        metric: "active_connections",
      },
    });
  });
});
