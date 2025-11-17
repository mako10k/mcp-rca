#!/usr/bin/env node
import { createCase, addObservation } from "../dist/data/caseStore.js";
import { hypothesisProposeTool } from "../dist/tools/hypothesis.js";
import { caseGetTool } from "../dist/tools/case_get.js";
import { LLMProviderManager } from "../dist/llm/LLMProviderManager.js";

// Mock LLM output
LLMProviderManager.prototype.generateMessage = async () => ({
  content: JSON.stringify([
    {
      text: "Test hypothesis for Issue #1",
      rationale: "Verifying hypothesis retrieval with include parameter",
      testPlan: {
        method: "Test case_get with include=['hypotheses']",
        expected: "Hypotheses should be returned in the response",
      },
    },
  ]),
  model: "mock-llm",
});

const context = {
  requestId: "test-issue-1",
  now: () => new Date(),
  logger: {
    info: (msg, meta) => console.log("INFO:", msg, meta),
    error: (msg, meta) => console.error("ERROR:", msg, meta),
  },
};

// Create test case
const { case: testCase } = await createCase({
  title: "Test Issue #1 Fix",
  severity: "SEV1",
  tags: ["test", "issue-1"],
});

console.log("✓ Created test case:", testCase.id);

// Add observation
await addObservation({
  caseId: testCase.id,
  what: "Initial observation",
  context: "Testing hypothesis retrieval",
});

console.log("✓ Added observation");

// Propose hypothesis
const { hypotheses } = await hypothesisProposeTool.handler(
  {
    caseId: testCase.id,
    text: "Test hypothesis proposal",
  },
  context
);

console.log("✓ Proposed hypothesis:", hypotheses[0].id);

// Test 1: Get case with include=['hypotheses']
console.log("\nTest 1: case_get with include=['hypotheses']");
const result1 = await caseGetTool.handler(
  {
    caseId: testCase.id,
    include: ["hypotheses"],
  },
  context
);

if (result1.case.hypotheses.length > 0) {
  console.log("✓ PASS: Hypotheses retrieved with include=['hypotheses']");
  console.log("  Retrieved hypothesis:", result1.case.hypotheses[0].text);
} else {
  console.log("✗ FAIL: No hypotheses returned");
  process.exit(1);
}

// Verify observations are NOT included when not requested
if (result1.case.observations.length === 0) {
  console.log("✓ PASS: Observations correctly excluded");
} else {
  console.log("✗ FAIL: Observations should not be included");
  process.exit(1);
}

// Test 2: Get case with no include parameter (should return all)
console.log("\nTest 2: case_get with no include parameter");
const result2 = await caseGetTool.handler(
  {
    caseId: testCase.id,
  },
  context
);

if (result2.case.hypotheses.length > 0 && result2.case.observations.length > 0) {
  console.log("✓ PASS: All data returned when include not specified");
} else {
  console.log("✗ FAIL: Should return all data by default");
  process.exit(1);
}

// Test 3: Get case with multiple includes
console.log("\nTest 3: case_get with include=['observations', 'hypotheses']");
const result3 = await caseGetTool.handler(
  {
    caseId: testCase.id,
    include: ["observations", "hypotheses"],
  },
  context
);

if (result3.case.hypotheses.length > 0 && result3.case.observations.length > 0) {
  console.log("✓ PASS: Both observations and hypotheses retrieved");
} else {
  console.log("✗ FAIL: Should return both observations and hypotheses");
  process.exit(1);
}

console.log("\n✓ All tests passed! Issue #1 is fixed.");
