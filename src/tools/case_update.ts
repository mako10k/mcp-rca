import { z } from "zod";
import { updateCase } from "../data/caseStore.js";
import type { ToolContext, ToolDefinition } from "./types.js";
import { caseSchema, severitySchema } from "./case.js";

const statusEnum = z.enum(["active", "archived"]);

const caseUpdateInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  title: z.string().trim().optional(),
  severity: severitySchema.optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  status: statusEnum.optional(),
  gitBranch: z.string().trim().nullable().optional(),
  gitCommit: z.string().trim().nullable().optional(),
  deployEnv: z.string().trim().nullable().optional(),
});

const caseUpdateOutputSchema = z.object({
  case: caseSchema,
});

export type CaseUpdateInput = z.infer<typeof caseUpdateInputSchema>;
export type CaseUpdateOutput = z.infer<typeof caseUpdateOutputSchema>;

export const caseUpdateTool: ToolDefinition<CaseUpdateInput, CaseUpdateOutput> = {
  name: "case_update",
  description: "Modify case metadata or archive/unarchive a case.",
  inputSchema: caseUpdateInputSchema,
  outputSchema: caseUpdateOutputSchema,
  handler: async (input: CaseUpdateInput, context: ToolContext) => {
    if (
      !input.title &&
      !input.severity &&
      !input.tags &&
      !input.status &&
      input.gitBranch === undefined &&
      input.gitCommit === undefined &&
      input.deployEnv === undefined
    ) {
      throw new Error("At least one updatable field must be provided");
    }

    const result = await updateCase({
      caseId: input.caseId,
      title: input.title,
      severity: input.severity,
      tags: input.tags,
      status: input.status,
      gitBranch: input.gitBranch,
      gitCommit: input.gitCommit,
      deployEnv: input.deployEnv,
    });

    context.logger?.info("Updated case", {
      caseId: input.caseId,
      fields: {
        title: Boolean(input.title),
        severity: Boolean(input.severity),
        tags: Boolean(input.tags),
        status: Boolean(input.status),
        gitBranch: input.gitBranch !== undefined,
        gitCommit: input.gitCommit !== undefined,
        deployEnv: input.deployEnv !== undefined,
      },
    });

    return result;
  },
};
