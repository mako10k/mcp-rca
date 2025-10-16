import { z } from "zod";
import type { ToolDefinition } from "./types.js";

const prioritizationItemSchema = z.object({
  id: z.string(),
  reach: z.number().optional(),
  impact: z.number(),
  confidence: z.number(),
  effort: z.number().optional(),
  ease: z.number().optional(),
});

const prioritizeInputSchema = z.object({
  strategy: z.enum(["RICE", "ICE"]),
  items: z.array(prioritizationItemSchema).min(1),
});

const prioritizeOutputSchema = z.object({
  ranked: z.array(
    prioritizationItemSchema.extend({
      score: z.number(),
      rank: z.number(),
    }),
  ),
});

export type PrioritizeInput = z.infer<typeof prioritizeInputSchema>;
export type PrioritizeOutput = z.infer<typeof prioritizeOutputSchema>;

export const prioritizeTool: ToolDefinition<PrioritizeInput, PrioritizeOutput> = {
  name: "test/prioritize",
  description: "Rank queued test plans using RICE or ICE scoring heuristics.",
  inputSchema: prioritizeInputSchema,
  outputSchema: prioritizeOutputSchema,
  handler: async (input: PrioritizeInput) => {
    const ranked = input.items
      .map((item) => {
        const score =
          input.strategy === "RICE"
            ? ((item.reach ?? 1) * item.impact * item.confidence) / Math.max(item.effort ?? 1, 0.1)
            : item.impact * item.confidence * (item.ease ?? 1);
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return { ranked };
  },
};
