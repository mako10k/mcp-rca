#!/usr/bin/env node
/**
 * Quick lowdb integration test - creates a case, adds hypotheses, tests bulk_delete
 */

import { createCase, addObservation, addHypothesis, addTestPlan, bulkDeleteProvisional, getCase } from "../dist/data/caseStore.js";

async function main() {
  console.log("🔍 Testing lowdb integration...\n");

  // 1. Create a test case
  console.log("1️⃣ Creating test case...");
  const { case: testCase } = await createCase({
    title: "lowdb integration test case",
    severity: "SEV2",
    tags: ["lowdb-test", "integration"],
    deployEnv: "staging",
  });
  console.log(`✅ Created case: ${testCase.id}`);

  // 2. Add observation
  console.log("\n2️⃣ Adding observation...");
  const { observation } = await addObservation({
    caseId: testCase.id,
    what: "Database write latency increased by 300%",
    context: "Observed during load test",
  });
  console.log(`✅ Added observation: ${observation.id}`);

  // 3. Add multiple hypotheses with varying confidence
  console.log("\n3️⃣ Adding hypotheses...");
  const hyp1 = await addHypothesis({
    caseId: testCase.id,
    text: "High confidence hypothesis",
    confidence: 0.9,
  });
  console.log(`✅ Added hypothesis (confidence 0.9): ${hyp1.hypothesis.id}`);

  const hyp2 = await addHypothesis({
    caseId: testCase.id,
    text: "Low confidence hypothesis",
    confidence: 0.2,
  });
  console.log(`✅ Added hypothesis (confidence 0.2): ${hyp2.hypothesis.id}`);

  const hyp3 = await addHypothesis({
    caseId: testCase.id,
    text: "No confidence hypothesis",
  });
  console.log(`✅ Added hypothesis (no confidence): ${hyp3.hypothesis.id}`);

  // 4. Add test plans with varying priority
  console.log("\n4️⃣ Adding test plans...");
  const tp1 = await addTestPlan({
    caseId: testCase.id,
    hypothesisId: hyp1.hypothesis.id,
    method: "Load test with monitoring",
    expected: "Latency returns to baseline",
  });
  console.log(`✅ Added test plan (no priority): ${tp1.testPlan.id}`);

  const tp2 = await addTestPlan({
    caseId: testCase.id,
    hypothesisId: hyp2.hypothesis.id,
    method: "Check query plan",
    expected: "Query plan shows full table scan",
  });
  console.log(`✅ Added test plan (no priority): ${tp2.testPlan.id}`);

  // 5. Get case before bulk delete
  console.log("\n5️⃣ Fetching case before bulk delete...");
  const beforeDelete = await getCase(testCase.id);
  console.log(`📊 Before: ${beforeDelete.case.hypotheses.length} hypotheses, ${beforeDelete.case.tests.length} test plans`);

  // 6. Bulk delete provisional items
  console.log("\n6️⃣ Running bulk_delete_provisional (confidence < 0.5, priority > 3)...");
  const deleteResult = await bulkDeleteProvisional({
    caseId: testCase.id,
    confidenceThreshold: 0.5,
    priorityThreshold: 3,
  });
  console.log(`✅ Deleted ${deleteResult.deletedHypotheses.length} hypotheses, ${deleteResult.deletedTestPlans.length} test plans`);
  console.log(`   Deleted hypothesis IDs: ${deleteResult.deletedHypotheses.map(h => h.id).join(", ")}`);

  // 7. Get case after bulk delete
  console.log("\n7️⃣ Fetching case after bulk delete...");
  const afterDelete = await getCase(testCase.id);
  console.log(`📊 After: ${afterDelete.case.hypotheses.length} hypotheses, ${afterDelete.case.tests.length} test plans`);
  console.log(`   Remaining hypothesis confidences: ${afterDelete.case.hypotheses.map(h => h.confidence ?? "none").join(", ")}`);

  console.log("\n✨ All tests completed successfully!");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
