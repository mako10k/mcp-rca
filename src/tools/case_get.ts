import { z } from "zod";
import { getCase } from "../data/caseStore.js";
import type { Observation } from "../schema/case.js";
import { caseSchema } from "./case.js";
import type { ToolContext, ToolDefinition } from "./types.js";

const includeEnum = z.enum(["observations", "hypotheses", "tests", "results"]);

const caseGetInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  include: z.array(includeEnum).optional(),
  observationCursor: z.string().optional(),
  observationLimit: z.number().int().min(1).max(100).optional(),
});

const cursorsSchema = z
  .object({
    nextObservationCursor: z.string().optional(),
    observationLimit: z.number().int().min(1).optional(),
    observationReturned: z.number().int().min(0).optional(),
    observationTotal: z.number().int().min(0).optional(),
    hasMoreObservations: z.boolean().optional(),
  })
  .optional();

const caseGetOutputSchema = z.object({
  case: caseSchema,
  cursors: cursorsSchema,
});

export type CaseGetInput = z.infer<typeof caseGetInputSchema>;
export type CaseGetOutput = z.infer<typeof caseGetOutputSchema>;

const DEFAULT_OBSERVATION_LIMIT = 20;

interface ObservationCursorPayload {
  offset: number;
}

function encodeObservationCursor(payload: ObservationCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeObservationCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as ObservationCursorPayload;
    if (typeof parsed?.offset === "number" && parsed.offset >= 0) {
      return parsed.offset;
    }
  } catch {
    // fall through to default
  }
  return 0;
}

function sliceObservations(
  observations: Observation[],
  limit: number,
  offset: number,
): { slice: Observation[]; nextCursor?: string } {
  if (observations.length === 0) {
    return { slice: [] };
  }

  const boundedOffset = Math.max(0, Math.min(offset, observations.length));
  const window = observations.slice(boundedOffset, boundedOffset + limit);
  const nextOffset = boundedOffset + limit;
  const nextCursor = nextOffset < observations.length ? encodeObservationCursor({ offset: nextOffset }) : undefined;

  return { slice: window, nextCursor };
}

export const caseGetTool: ToolDefinition<CaseGetInput, CaseGetOutput> = {
  name: "case_get",
  description: "Fetch the latest state of a single RCA case with optional observation paging.",
  inputSchema: caseGetInputSchema,
  outputSchema: caseGetOutputSchema,
  handler: async (input: CaseGetInput, context: ToolContext) => {
    const result = await getCase(input.caseId);
    if (!result) {
      throw new Error(`Case ${input.caseId} not found`);
    }

    // If include is not specified, return all data (backward compatibility)
    // If include is specified, only return the requested collections
    const includeAll = input.include === undefined;
    const includeObservations = includeAll || (input.include?.includes("observations") ?? false);
    const includeHypotheses = includeAll || (input.include?.includes("hypotheses") ?? false);
    const includeTests = includeAll || (input.include?.includes("tests") ?? false);
    const includeResults = includeAll || (input.include?.includes("results") ?? false);
    
    const totalObservations = result.case.observations.length;
    const observationLimit = input.observationLimit ?? DEFAULT_OBSERVATION_LIMIT;
    const observationOffset = decodeObservationCursor(input.observationCursor);

    let nextObservationCursor: string | undefined;
    let observations = result.case.observations;
    let pagination:
      | {
          nextObservationCursor?: string;
          observationLimit: number;
          observationReturned: number;
          observationTotal: number;
          hasMoreObservations: boolean;
        }
      | undefined;

    if (includeObservations) {
      const sliced = sliceObservations(observations, observationLimit, observationOffset);
      observations = sliced.slice;
      nextObservationCursor = sliced.nextCursor;
      pagination = {
        nextObservationCursor,
        observationLimit,
        observationReturned: observations.length,
        observationTotal: totalObservations,
        hasMoreObservations: Boolean(nextObservationCursor),
      };
    } else {
      observations = [];
    }

    const responseCase = {
      ...result.case,
      observations,
      hypotheses: includeHypotheses ? result.case.hypotheses : [],
      tests: includeTests ? result.case.tests : [],
      results: includeResults ? result.case.results : [],
    };

    context.logger?.info("Fetched case", {
      caseId: input.caseId,
      includeObservations,
      includeHypotheses,
      includeTests,
      includeResults,
      observationLimit,
      observationReturned: pagination?.observationReturned ?? 0,
      observationTotal: totalObservations,
    });

    return {
      case: responseCase,
      cursors: includeObservations && pagination
        ? {
            nextObservationCursor: pagination.nextObservationCursor,
            observationLimit: pagination.observationLimit,
            observationReturned: pagination.observationReturned,
            observationTotal: pagination.observationTotal,
            hasMoreObservations: pagination.hasMoreObservations,
          }
        : undefined,
    };
  },
};
