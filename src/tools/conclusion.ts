import type { Conclusion } from "../schema/result.js";
import type { ToolDefinition } from "./types.js";

export interface ConclusionInput {
  caseId: string;
  rootCauses: string[];
  fix: string;
  followUps?: string[];
}

export interface ConclusionOutput {
  conclusion: Conclusion;
}

export const conclusionTool: ToolDefinition<ConclusionInput, ConclusionOutput> = {
  name: "conclusion/finalize",
  description: "Close the RCA case with the agreed root cause and follow-up actions.",
  inputSchema: {
    type: "object",
    required: ["caseId", "rootCauses", "fix"],
    properties: {
      caseId: { type: "string" },
      rootCauses: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
      fix: { type: "string" },
      followUps: {
        type: "array",
        items: { type: "string" },
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    required: ["conclusion"],
    properties: {
      conclusion: {
        type: "object",
        properties: {
          id: { type: "string" },
          caseId: { type: "string" },
          rootCauses: {
            type: "array",
            items: { type: "string" },
          },
          fix: { type: "string" },
          followUps: {
            type: "array",
            items: { type: "string" },
          },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
          confidenceMarker: {
            type: "string",
            enum: ["🟢", "🔵", "🟡", "🔴"],
          },
        },
        required: ["id", "caseId", "rootCauses", "fix", "createdAt", "updatedAt"],
      },
    },
  },
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
