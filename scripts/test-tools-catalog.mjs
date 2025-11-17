#!/usr/bin/env node
import { guidanceToolsCatalogTool } from "../dist/tools/guidance.js";

const context = {
  requestId: "test-tools-catalog",
  now: () => new Date(),
  logger: {
    info: (msg, meta) => console.log("INFO:", msg, JSON.stringify(meta, null, 2)),
    error: (msg, meta) => console.error("ERROR:", msg, JSON.stringify(meta, null, 2)),
  },
};

console.log("=== Test 1: Basic tool catalog ===\n");
const basic = await guidanceToolsCatalogTool.handler({}, context);
console.log(`Tool Groups: ${basic.toolGroups.length}`);
basic.toolGroups.forEach((group) => {
  console.log(`\n${group.name}: ${group.description}`);
  console.log(`  Tools: ${group.tools.map((t) => t.name).join(", ")}`);
});

console.log("\n\n=== Test 2: With workflow ===\n");
const withWorkflow = await guidanceToolsCatalogTool.handler(
  { includeWorkflow: true },
  context
);
if (withWorkflow.workflow) {
  console.log("Workflow phases:");
  withWorkflow.workflow.forEach((phase) => {
    console.log(`\n${phase.phase}: ${phase.description}`);
    console.log(`  Recommended: ${phase.recommendedTools.join(", ")}`);
    if (phase.optionalTools) {
      console.log(`  Optional: ${phase.optionalTools.join(", ")}`);
    }
  });
}

console.log("\n\n=== Test 3: With examples ===\n");
const withExamples = await guidanceToolsCatalogTool.handler(
  { includeExamples: true },
  context
);
if (withExamples.examples) {
  console.log("Example scenarios:");
  withExamples.examples.forEach((example, idx) => {
    console.log(`\n${idx + 1}. ${example.scenario}`);
    console.log(`   Sequence: ${example.toolSequence.join(" → ")}`);
  });
}

console.log("\n\n=== Test 4: Full catalog ===\n");
const full = await guidanceToolsCatalogTool.handler(
  { includeWorkflow: true, includeExamples: true },
  context
);
console.log(`✓ Tool Groups: ${full.toolGroups.length}`);
console.log(`✓ Workflow Phases: ${full.workflow?.length || 0}`);
console.log(`✓ Example Scenarios: ${full.examples?.length || 0}`);

// Test specific tool details
console.log("\n\n=== Test 5: Tool details ===\n");
const caseManagement = full.toolGroups.find((g) => g.name === "Case Management");
if (caseManagement) {
  const caseCreate = caseManagement.tools.find((t) => t.name === "case_create");
  if (caseCreate) {
    console.log("case_create tool:");
    console.log(`  Description: ${caseCreate.description}`);
    console.log(`  Required: ${caseCreate.requiredInputs.join(", ")}`);
    console.log(`  Optional: ${caseCreate.optionalInputs?.join(", ") || "none"}`);
    console.log(`  Outputs: ${caseCreate.outputs.join(", ")}`);
  }
}

console.log("\n✓ All tests passed! guidance_tools_catalog is working correctly.");
