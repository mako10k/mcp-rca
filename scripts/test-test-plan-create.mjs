#!/usr/bin/env node
import { testPlanTool } from "../dist/tools/test_plan.js";

const [caseId, hypothesisId] = process.argv.slice(2);

if (!caseId || !hypothesisId) {
  console.error("Usage: node scripts/test-test-plan-create.mjs <caseId> <hypothesisId>");
  process.exit(1);
}

const context = {
  requestId: "test-test-plan",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

const response = await testPlanTool.handler(
  {
    caseId,
    hypothesisId,
    method: "Check database connection pool metrics",
    expected: "Pool utilization should be below 80%",
    metric: "connection_pool_utilization",
  },
  context,
);

console.log("Test plan creation result:");
console.log(JSON.stringify(response, null, 2));