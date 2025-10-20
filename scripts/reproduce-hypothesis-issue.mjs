#!/usr/bin/env node
import { hypothesisProposeTool } from "../dist/tools/hypothesis.js";
import { getCase } from "../dist/data/caseStore.js";
import { LLMProviderManager } from "../dist/llm/LLMProviderManager.js";

const [caseId] = process.argv.slice(2);

if (!caseId) {
  console.error("Usage: node scripts/reproduce-hypothesis-issue.mjs <caseId>");
  process.exit(1);
}

// Stub LLM output so we can reproduce deterministically without external providers.
LLMProviderManager.prototype.generateMessage = async () => ({
  content: JSON.stringify([
    {
      text: "Mock hypothesis: primary database hot failover misconfigured",
      rationale: "Failover attempts logged repeatedly during incident window",
      testPlan: {
        method: "Inspect failover controller logs",
        expected: "Misconfiguration entries with missing replica metadata",
      },
    },
  ]),
  model: "mock-llm",
});

const context = {
  requestId: "repro",
  now: () => new Date(),
  logger: {
    info: () => {},
    error: () => {},
  },
};

const response = await hypothesisProposeTool.handler(
  {
    caseId,
    text: "Synthetic outage reproduction",
    rationale: "Verifying persistence bug",
  },
  context,
);

const caseData = await getCase(caseId);

const persistedHypotheses = caseData?.case.hypotheses ?? null;

console.log(
  JSON.stringify(
    {
      generatedCount: response.hypotheses.length,
      persistedCount: Array.isArray(persistedHypotheses) ? persistedHypotheses.length : null,
      persistedHypotheses,
    },
    null,
    2,
  ),
);
