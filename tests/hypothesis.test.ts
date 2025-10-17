import { describe, expect, it, vi } from "vitest";
import { generateHypotheses } from "../src/llm/generator.js";
import { clearSamplingServer, setSamplingServer } from "../src/llm/samplingClient.js";

describe("generateHypotheses", () => {
  it("returns hypotheses via SamplingProvider when no client/API key is provided (MCP sampling mock)", async () => {
    // APIキーなしでSamplingProviderが使われることを確認
    const oldOpenAI = process.env.OPENAI_API_KEY;
    const oldAnthropic = process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    // SamplingProviderの応答をモック
    const mockHypotheses = [
      {
        text: "DB負荷増大によるレイテンシ上昇",
        rationale: "ピーク時に接続数が増加し、インデックスが効かないクエリが増えたため",
        testPlan: {
          method: "クエリログ分析",
          expected: "ピーク時に遅いクエリが集中していることを確認",
        },
      },
    ];

    const mockServer = {
      createMessage: vi.fn().mockResolvedValue({
        content: { type: "text", text: JSON.stringify(mockHypotheses) },
        model: "mock-sampling",
      }),
    } as unknown as { createMessage: (request: unknown) => Promise<unknown> };

    setSamplingServer(mockServer as unknown as any);

    try {
      const result = await generateHypotheses({
        caseId: "case-123",
        text: "Database latency increases during peaks",
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].text).toContain("DB負荷増大");
      expect(result[0].testPlan.method).toBe("クエリログ分析");
    } finally {
      // Restore environment
      if (oldOpenAI) process.env.OPENAI_API_KEY = oldOpenAI;
      if (oldAnthropic) process.env.ANTHROPIC_API_KEY = oldAnthropic;
      clearSamplingServer();
    }
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

  it("parses JSON embedded in markdown fences", async () => {
    const fakeClient = {
      complete: vi.fn().mockResolvedValue(
        "# Heading\n```json\n[{\"text\":\"Example\",\"rationale\":\"Reason\",\"testPlan\":{\"method\":\"Inspect\",\"expected\":\"Data\"}}]\n```"
      ),
    };

    const result = await generateHypotheses(
      {
        caseId: "case-789",
        text: "Service degraded",
      },
      fakeClient
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Example");
  });

  it("returns raw string when JSON parsing fails", async () => {
    const fakeClient = {
      complete: vi.fn().mockResolvedValue("Plain text response without JSON"),
    };

    const result = await generateHypotheses(
      {
        caseId: "case-101",
        text: "Unknown issue",
      },
      fakeClient
    );

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Plain text response without JSON");
    expect(result[0].testPlan.method).toBe("Operator review");
  });
});
