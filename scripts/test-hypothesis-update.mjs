#!/usr/bin/env node
import { hypothesisUpdateTool } from "../dist/tools/hypothesis_update.js";

const [caseId, hypothesisId] = process.argv.slice(2);

if (!caseId || !hypothesisId) {
  console.error("Usage: node scripts/test-hypothesis-update.mjs <caseId> <hypothesisId>");
  process.exit(1);
}

const context = {
  requestId: "test-update",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

const response = await hypothesisUpdateTool.handler(
  {
    caseId,
    hypothesisId,
    text: "Updated hypothesis: database connection pool exhausted",
    rationale: "Connection pool metrics show 100% utilization during incident",
    confidence: 0.8,
  },
  context,
);

console.log("Update result:");
console.log(JSON.stringify(response, null, 2));