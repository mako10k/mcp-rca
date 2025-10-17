import { z } from "zod";
import type { Conclusion } from "../schema/result.js";
import type { ToolDefinition } from "./types.js";

const conclusionInputSchema = z.object({
  caseId: z.string(),
  rootCauses: z.array(z.string()).min(1),
  fix: z.string(),
  followUps: z.array(z.string()).optional(),
});

const conclusionSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  rootCauses: z.array(z.string()).min(1),
  fix: z.string(),
  followUps: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  confidenceMarker: z.enum(["🟢", "🔵", "🟡", "🔴"]).optional(),
});

const conclusionOutputSchema = z.object({
  conclusion: conclusionSchema,
});

export type ConclusionInput = z.infer<typeof conclusionInputSchema>;
export type ConclusionOutput = z.infer<typeof conclusionOutputSchema>;

export const conclusionTool: ToolDefinition<ConclusionInput, ConclusionOutput> = {
  name: "conclusion_finalize",
  description: "Close the RCA case with the agreed root cause and follow-up actions.",
  inputSchema: conclusionInputSchema,
  outputSchema: conclusionOutputSchema,
  handler: async (input: ConclusionInput) => {
    const timestamp = new Date().toISOString();
    return {
      conclusion: {
        id: `conc_${Date.now()}`,
        caseId: input.caseId,
        rootCauses: input.rootCauses,
        fix: input.fix,
        followUps: input.followUps,
        createdAt: timestamp,
        updatedAt: timestamp,
        confidenceMarker: "🟢",
      },
    };
  },
};
