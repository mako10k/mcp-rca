import { z } from "zod";
import { addObservation } from "../data/caseStore.js";
import type { Observation } from "../schema/case.js";
import { caseSchema } from "./case.js";
import type { ToolDefinition, ToolContext } from "./types.js";

export const observationSchema: z.ZodType<Observation> = z.object({
  id: z.string(),
  caseId: z.string(),
  what: z.string(),
  context: z.string().optional(),
  gitBranch: z.string().optional(),
  gitCommit: z.string().optional(),
  deployEnv: z.string().optional(),
  createdAt: z.string(),
});

const observationAddInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  what: z.string().trim().min(1, "Observation text is required"),
  context: z.string().trim().optional(),
  gitBranch: z.string().trim().optional(),
  gitCommit: z.string().trim().optional(),
  deployEnv: z.string().trim().optional(),
});

const observationAddOutputSchema = z.object({
  caseId: z.string(),
  observation: observationSchema,
  case: caseSchema,
});

export type ObservationAddInput = z.infer<typeof observationAddInputSchema>;
export type ObservationAddOutput = z.infer<typeof observationAddOutputSchema>;

export const observationAddTool: ToolDefinition<ObservationAddInput, ObservationAddOutput> = {
  name: "observation_add",
  description: "Append a new observation to an existing RCA case.",
  inputSchema: observationAddInputSchema,
  outputSchema: observationAddOutputSchema,
  handler: async (input: ObservationAddInput, context: ToolContext) => {
    const cleanedContext = input.context?.trim();
    const { observation, case: updatedCase } = await addObservation({
      caseId: input.caseId,
      what: input.what.trim(),
      context: cleanedContext && cleanedContext.length > 0 ? cleanedContext : undefined,
      gitBranch: input.gitBranch?.trim() || undefined,
      gitCommit: input.gitCommit?.trim() || undefined,
      deployEnv: input.deployEnv?.trim() || undefined,
    });

    context.logger?.info("Added observation", {
      caseId: input.caseId,
      observationId: observation.id,
    });

    return {
      caseId: input.caseId,
      observation,
      case: updatedCase,
    };
  },
};
