#!/usr/bin/env node
import { testPlanUpdateTool } from "../dist/tools/test_plan_update.js";

const [caseId, testPlanId] = process.argv.slice(2);

if (!caseId || !testPlanId) {
  console.error("Usage: node scripts/test-test-plan-update.mjs <caseId> <testPlanId>");
  process.exit(1);
}

const context = {
  requestId: "test-update-plan",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

const response = await testPlanUpdateTool.handler(
  {
    caseId,
    testPlanId,
    method: "Monitor database connection pool metrics in real-time",
    expected: "Pool utilization should remain below 70% during peak hours",
    metric: "connection_pool_utilization_percent",
    priority: 2,
  },
  context,
);

console.log("Test plan update result:");
console.log(JSON.stringify(response, null, 2));