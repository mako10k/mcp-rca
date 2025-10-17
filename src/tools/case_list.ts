import { z } from "zod";
import { listCases } from "../data/caseStore.js";
import type { ToolContext, ToolDefinition } from "./types.js";

const severityValues = ["SEV1", "SEV2", "SEV3"] as const;
const statusValues = ["active", "archived"] as const;

const caseSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(severityValues),
  status: z.enum(statusValues),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  observationCount: z.number().int().nonnegative(),
});

const caseListInputSchema = z.object({
  query: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  severity: z.enum(severityValues).optional(),
  includeArchived: z.boolean().optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

const caseListOutputSchema = z.object({
  cases: z.array(caseSummarySchema),
  nextCursor: z.string().optional(),
  total: z.number().int().nonnegative(),
});

export type CaseListInput = z.infer<typeof caseListInputSchema>;
export type CaseListOutput = z.infer<typeof caseListOutputSchema>;

export const caseListTool: ToolDefinition<CaseListInput, CaseListOutput> = {
  name: "case_list",
  description: "List RCA cases with filtering and cursor-based pagination.",
  inputSchema: caseListInputSchema,
  outputSchema: caseListOutputSchema,
  handler: async (input: CaseListInput, context: ToolContext) => {
    const result = await listCases({
      query: input.query,
      tags: input.tags,
      severity: input.severity,
      includeArchived: input.includeArchived,
      pageSize: input.pageSize,
      cursor: input.cursor,
    });

    context.logger?.info("Listed cases", {
      count: result.cases.length,
      total: result.total,
    });

    return result;
  },
};
