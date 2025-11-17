import { z } from "zod";
import {
  listObservations,
  type ObservationSearchField,
  type ObservationSortBy,
  type SortOrder,
} from "../data/caseStore.js";
import type { Observation } from "../schema/case.js";
import { observationSchema } from "./observation.js";
import type { ToolContext, ToolDefinition } from "./types.js";

const searchFieldEnum = z.enum(["what", "context"]);
const sortByEnum = z.enum(["createdAt"]);
const sortOrderEnum = z.enum(["asc", "desc"]);

const observationListInputSchema = z.object({
  caseId: z.string().min(1, "Case identifier is required"),
  query: z.string().trim().optional(),
  fields: z.array(searchFieldEnum).min(1).optional(),
  createdAfter: z.string().trim().optional(),
  createdBefore: z.string().trim().optional(),
  gitBranch: z.string().trim().optional(),
  gitCommit: z.string().trim().optional(),
  deployEnv: z.string().trim().optional(),
  sortBy: sortByEnum.optional(),
  order: sortOrderEnum.optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

const observationListOutputSchema = z.object({
  caseId: z.string(),
  observations: z.array(observationSchema as z.ZodType<Observation>),
  nextCursor: z.string().optional(),
  total: z.number().int().min(0),
  pageSize: z.number().int().min(1),
  hasMore: z.boolean(),
});

export type ObservationListInput = z.infer<typeof observationListInputSchema>;
export type ObservationListOutput = z.infer<typeof observationListOutputSchema>;

function parseDate(label: string, value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be an ISO 8601 date string`);
  }
  return date;
}

function normalizeFields(fields?: ObservationSearchField[]): ObservationSearchField[] | undefined {
  if (!fields) {
    return undefined;
  }
  const unique = Array.from(new Set(fields));
  unique.sort();
  return unique;
}

export const observationsListTool: ToolDefinition<ObservationListInput, ObservationListOutput> = {
  name: "observations_list",
  description: "List observations for a case with filtering, search, and pagination.",
  inputSchema: observationListInputSchema,
  outputSchema: observationListOutputSchema,
  handler: async (input: ObservationListInput, context: ToolContext) => {
    const createdAfter = parseDate("createdAfter", input.createdAfter);
    const createdBefore = parseDate("createdBefore", input.createdBefore);

    if (createdAfter && createdBefore && createdAfter > createdBefore) {
      throw new Error("createdAfter must be earlier than or equal to createdBefore");
    }

    const fields = normalizeFields(input.fields as ObservationSearchField[] | undefined);
    const result = await listObservations({
      caseId: input.caseId,
      query: input.query,
      fields,
      createdAfter,
      createdBefore,
      gitBranch: input.gitBranch || undefined,
      gitCommit: input.gitCommit || undefined,
      deployEnv: input.deployEnv || undefined,
      sortBy: (input.sortBy as ObservationSortBy | undefined) ?? "createdAt",
      order: (input.order as SortOrder | undefined) ?? "asc",
      pageSize: input.pageSize,
      cursor: input.cursor,
    });

    context.logger?.info("Listed observations", {
      caseId: input.caseId,
      query: input.query,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: Boolean(result.nextCursor),
    });

    return {
      caseId: input.caseId,
      observations: result.observations,
      nextCursor: result.nextCursor,
      total: result.total,
      pageSize: result.pageSize,
      hasMore: Boolean(result.nextCursor),
    };
  },
};
