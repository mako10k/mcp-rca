#!/usr/bin/env node
import { hypothesisFinalizeTool } from "../dist/tools/hypothesis_finalize.js";

const [caseId, hypothesisId] = process.argv.slice(2);

if (!caseId || !hypothesisId) {
  console.error("Usage: node scripts/test-hypothesis-finalize.mjs <caseId> <hypothesisId>");
  process.exit(1);
}

const context = {
  requestId: "test-finalize",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

const response = await hypothesisFinalizeTool.handler(
  {
    caseId,
    hypothesisId,
  },
  context,
);

console.log("Finalize result:");
console.log(JSON.stringify(response, null, 2));