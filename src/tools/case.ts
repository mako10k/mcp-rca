import { z } from "zod";
import { createCase } from "../data/caseStore.js";
import type { Case } from "../schema/case.js";
import type { ToolContext, ToolDefinition } from "./types.js";

export const severitySchema = z.enum(["SEV1", "SEV2", "SEV3"]);

export const caseSchema: z.ZodType<Case> = z.object({
  id: z.string(),
  title: z.string(),
  severity: severitySchema,
  tags: z.array(z.string()),
  status: z.enum(["active", "archived"]),
  gitBranch: z.string().optional(),
  gitCommit: z.string().optional(),
  deployEnv: z.string().optional(),
  observations: z.array(z.any()),
  impacts: z.array(z.any()),
  hypotheses: z.array(z.any()),
  tests: z.array(z.any()),
  results: z.array(z.any()),
  conclusion: z.any().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const caseCreateInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  severity: severitySchema,
  tags: z.array(z.string().trim().min(1)).optional(),
  gitBranch: z.string().trim().optional(),
  gitCommit: z.string().trim().optional(),
  deployEnv: z.string().trim().optional(),
});

const caseCreateOutputSchema = z.object({
  caseId: z.string(),
  case: caseSchema,
});

export type CaseCreateInput = z.infer<typeof caseCreateInputSchema>;
export type CaseCreateOutput = z.infer<typeof caseCreateOutputSchema>;

function normalizeTags(tags: string[]): string[] {
  const trimmed = tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  const unique = Array.from(new Set(trimmed));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

export const caseCreateTool: ToolDefinition<CaseCreateInput, CaseCreateOutput> = {
  name: "case_create",
  description: "Create a new RCA case with metadata for subsequent investigation.",
  inputSchema: caseCreateInputSchema,
  outputSchema: caseCreateOutputSchema,
  handler: async (input: CaseCreateInput, context: ToolContext) => {
    const tags = normalizeTags(input.tags ?? []);
    const result = await createCase({
      title: input.title,
      severity: input.severity,
      tags,
      gitBranch: input.gitBranch?.trim() || undefined,
      gitCommit: input.gitCommit?.trim() || undefined,
      deployEnv: input.deployEnv?.trim() || undefined,
    });

    context.logger?.info("Created RCA case", { caseId: result.case.id, title: input.title });

    return {
      caseId: result.case.id,
      case: result.case,
    };
  },
};
