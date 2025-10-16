import type { ToolDefinition } from "./types.js";

interface PrioritizationItem {
  id: string;
  reach?: number;
  impact: number;
  confidence: number;
  effort?: number;
  ease?: number;
}

export interface PrioritizeInput {
  strategy: "RICE" | "ICE";
  items: PrioritizationItem[];
}

export interface PrioritizeOutput {
  ranked: Array<PrioritizationItem & { score: number; rank: number }>;
}

export const prioritizeTool: ToolDefinition<PrioritizeInput, PrioritizeOutput> = {
  name: "test/prioritize",
  description: "Rank queued test plans using RICE or ICE scoring heuristics.",
  inputSchema: {
    type: "object",
    required: ["strategy", "items"],
    properties: {
      strategy: { type: "string", enum: ["RICE", "ICE"] },
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "impact", "confidence"],
          properties: {
            id: { type: "string" },
            reach: { type: "number" },
            impact: { type: "number" },
            confidence: { type: "number" },
            effort: { type: "number" },
            ease: { type: "number" },
          },
        },
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    required: ["ranked"],
    properties: {
      ranked: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            reach: { type: "number" },
            impact: { type: "number" },
            confidence: { type: "number" },
            effort: { type: "number" },
            ease: { type: "number" },
            score: { type: "number" },
            rank: { type: "number" },
          },
          required: ["id", "impact", "confidence", "score", "rank"],
        },
      },
    },
  },
  handler: async (input: PrioritizeInput) => {
    const ranked = input.items
      .map((item: PrioritizationItem) => {
        const score =
          input.strategy === "RICE"
            ? ((item.reach ?? 1) * item.impact * item.confidence) /
              Math.max(item.effort ?? 1, 0.1)
            : item.impact * item.confidence * (item.ease ?? 1);
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return { ranked };
  },
};
