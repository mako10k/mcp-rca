import { z } from "zod";
import { removeObservation } from "../data/caseStore.js";
import { caseSchema } from "./case.js";
import type { ToolDefinition, ToolContext } from "./types.js";

const observationSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  what: z.string(),
  context: z.string().optional(),
  createdAt: z.string(),
});

const observationRemoveInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  observationId: z.string().min(1, "Observation identifier is required"),
});

const observationRemoveOutputSchema = z.object({
  caseId: z.string(),
  observation: observationSchema,
  case: caseSchema,
});

export type ObservationRemoveInput = z.infer<typeof observationRemoveInputSchema>;
export type ObservationRemoveOutput = z.infer<typeof observationRemoveOutputSchema>;

export const observationRemoveTool: ToolDefinition<
  ObservationRemoveInput,
  ObservationRemoveOutput
> = {
  name: "observation_remove",
  description: "Remove an observation from an existing RCA case.",
  inputSchema: observationRemoveInputSchema,
  outputSchema: observationRemoveOutputSchema,
  handler: async (input: ObservationRemoveInput, context: ToolContext) => {
    const result = await removeObservation({
      caseId: input.caseId,
      observationId: input.observationId,
    });

    context.logger?.info("Removed observation", {
      caseId: input.caseId,
      observationId: input.observationId,
    });

    return {
      caseId: input.caseId,
      observation: result.observation,
      case: result.case,
    };
  },
};
