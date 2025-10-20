#!/usr/bin/env node
import { hypothesisProposeTool } from "../dist/tools/hypothesis.js";
import { testPlanTool } from "../dist/tools/test_plan.js";

const [caseId] = process.argv.slice(2);

if (!caseId) {
  console.error("Usage: node scripts/test-create-low-confidence.mjs <caseId>");
  process.exit(1);
}

// Stub LLM output for low confidence hypothesis
const originalGenerate = LLMProviderManager.prototype.generateMessage;
LLMProviderManager.prototype.generateMessage = async () => ({
  content: JSON.stringify([
    {
      text: "Low confidence hypothesis: network latency spike",
      rationale: "Possible network issue but not confirmed",
      testPlan: {
        method: "Check network latency metrics",
        expected: "Latency should be within normal range",
      },
    },
  ]),
  model: "mock-llm",
});

const context = {
  requestId: "test-low-conf",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

try {
  // Propose hypothesis
  const hypResponse = await hypothesisProposeTool.handler(
    {
      caseId,
      text: "Network issue test",
      rationale: "Testing low confidence scenario",
    },
    context,
  );

  console.log("Hypothesis created:", hypResponse.hypotheses[0]);

  // Create test plan with high priority
  const testResponse = await testPlanTool.handler(
    {
      caseId,
      hypothesisId: hypResponse.hypotheses[0].id, // This won't work since id is not returned
      method: "Check network latency metrics",
      expected: "Latency should be within normal range",
      metric: "network_latency",
    },
    context,
  );

  console.log("Test plan created:", testResponse);
} finally {
  // Restore original
  LLMProviderManager.prototype.generateMessage = originalGenerate;
}