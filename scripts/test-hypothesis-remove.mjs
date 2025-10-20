#!/usr/bin/env node
import { hypothesisRemoveTool } from "../dist/tools/hypothesis_remove.js";

const [caseId, hypothesisId] = process.argv.slice(2);

if (!caseId || !hypothesisId) {
  console.error("Usage: node scripts/test-hypothesis-remove.mjs <caseId> <hypothesisId>");
  process.exit(1);
}

const context = {
  requestId: "test-remove-hypothesis",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

const response = await hypothesisRemoveTool.handler(
  {
    caseId,
    hypothesisId,
  },
  context,
);

console.log("Hypothesis remove result:");
console.log(JSON.stringify(response, null, 2));