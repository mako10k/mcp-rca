#!/usr/bin/env node
import { testPlanRemoveTool } from "../dist/tools/test_plan_remove.js";

const [caseId, testPlanId] = process.argv.slice(2);

if (!caseId || !testPlanId) {
  console.error("Usage: node scripts/test-test-plan-remove.mjs <caseId> <testPlanId>");
  process.exit(1);
}

const context = {
  requestId: "test-remove-plan",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

const response = await testPlanRemoveTool.handler(
  {
    caseId,
    testPlanId,
  },
  context,
);

console.log("Test plan remove result:");
console.log(JSON.stringify(response, null, 2));