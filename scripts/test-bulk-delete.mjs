#!/usr/bin/env node
import { bulkDeleteProvisionalTool } from "../dist/tools/bulk_delete_provisional.js";

const [caseId] = process.argv.slice(2);

if (!caseId) {
  console.error("Usage: node scripts/test-bulk-delete.mjs <caseId>");
  process.exit(1);
}

const context = {
  requestId: "test-bulk-delete",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

const response = await bulkDeleteProvisionalTool.handler(
  {
    caseId,
    confidenceThreshold: 0.5,
    priorityThreshold: 3,
  },
  context,
);

console.log("Bulk delete result:");
console.log(JSON.stringify(response, null, 2));