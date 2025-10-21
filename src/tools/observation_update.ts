import { z } from "zod";
import { updateObservation } from "../data/caseStore.js";
import { caseSchema } from "./case.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const observationSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  what: z.string(),
  context: z.string().optional(),
  gitBranch: z.string().optional(),
  gitCommit: z.string().optional(),
  deployEnv: z.string().optional(),
  createdAt: z.string(),
});

const observationUpdateInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  observationId: z.string().min(1, "Observation identifier is required"),
  what: z.string().trim().optional(),
  context: z.string().trim().optional(),
  gitBranch: z.string().trim().nullable().optional(),
  gitCommit: z.string().trim().nullable().optional(),
  deployEnv: z.string().trim().nullable().optional(),
});

const observationUpdateOutputSchema = z.object({
  caseId: z.string(),
  observation: observationSchema,
  case: caseSchema,
});

export type ObservationUpdateInput = z.infer<typeof observationUpdateInputSchema>;
export type ObservationUpdateOutput = z.infer<typeof observationUpdateOutputSchema>;

export const observationUpdateTool: ToolDefinition<
  ObservationUpdateInput,
  ObservationUpdateOutput
> = {
  name: "observation_update",
  description: "Modify an observation's summary or context for an existing RCA case.",
  inputSchema: observationUpdateInputSchema,
  outputSchema: observationUpdateOutputSchema,
  handler: async (input: ObservationUpdateInput, context: ToolContext) => {
    if (
      input.what === undefined &&
      input.context === undefined &&
      input.gitBranch === undefined &&
      input.gitCommit === undefined &&
      input.deployEnv === undefined
    ) {
      throw new Error("Provide at least one field to update");
    }
    const result = await updateObservation({
      caseId: input.caseId,
      observationId: input.observationId,
      what: input.what,
      context: input.context,
      gitBranch: input.gitBranch,
      gitCommit: input.gitCommit,
      deployEnv: input.deployEnv,
    });

    context.logger?.info("Updated observation", {
      caseId: input.caseId,
      observationId: input.observationId,
      fields: {
        what: input.what !== undefined,
        context: input.context !== undefined,
        gitBranch: input.gitBranch !== undefined,
        gitCommit: input.gitCommit !== undefined,
        deployEnv: input.deployEnv !== undefined,
      },
    });

    return {
      caseId: input.caseId,
      observation: result.observation,
      case: result.case,
    };
  },
};
