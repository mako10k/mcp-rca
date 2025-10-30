import type { Case } from "../schema/case.js";

export interface CaseAnalysis {
  phase: "observation" | "hypothesis" | "testing" | "conclusion";
  needMoreObservations: boolean;
  needHypotheses: boolean;
  needTestPlans: boolean;
  readyForConclusion: boolean;
  topHypothesis?: {
    id: string;
    text: string;
    confidence: number;
  };
  hints: string[];
}

/**
 * Analyze a case to determine current phase and suggest next actions
 */
export function analyzeCase(caseData: Case): CaseAnalysis {
  const observations = caseData.observations.length;
  const hypotheses = caseData.hypotheses.length;
  const tests = caseData.tests.length;
  const hasConclusion = !!caseData.conclusion;

  // Determine current phase
  let phase: CaseAnalysis["phase"] = "observation";
  if (hasConclusion) {
    phase = "conclusion";
  } else if (tests > 0) {
    phase = "testing";
  } else if (hypotheses > 0) {
    phase = "hypothesis";
  }

  // Determine next actions
  const needMoreObservations = observations < 3;
  const needHypotheses = observations >= 3 && hypotheses === 0;
  const needTestPlans = hypotheses > 0 && tests === 0;

  // Check for high-confidence hypotheses
  const highConfidenceHypotheses = caseData.hypotheses.filter((h) => (h.confidence ?? 0) >= 0.8);
  const readyForConclusion = highConfidenceHypotheses.length > 0 && tests > 0;

  // Find top hypothesis
  const topHypothesis =
    caseData.hypotheses.length > 0
      ? caseData.hypotheses.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]
      : undefined;

  // Generate contextual hints
  const hints: string[] = [];

  if (needMoreObservations) {
    hints.push(
      "Still few observations. Add system metrics, logs, and timeline data.",
    );
  }

  if (observations >= 5 && hypotheses === 0) {
    hints.push(
      "Sufficient observations collected. Use hypothesis_propose to generate hypotheses with LLM assistance.",
    );
  }

  if (hypotheses > 0 && tests === 0) {
    hints.push(
      "Hypotheses created but no test plans. Define verification methods with test_plan.",
    );
  }

  if (tests > 3) {
    hints.push(
      "Use test_prioritize to rank test plans efficiently by RICE/ICE score.",
    );
  }

  if (readyForConclusion) {
    hints.push(
      "High-confidence hypothesis and tests completed. Summarize with conclusion_finalize.",
    );
  }

  const lowConfidenceCount = caseData.hypotheses.filter((h) => (h.confidence ?? 0) < 0.5).length;
  if (lowConfidenceCount > 3) {
    hints.push(
      `${lowConfidenceCount} low-confidence hypotheses exist. Clean up with bulk_delete_provisional.`,
    );
  }

  return {
    phase,
    needMoreObservations,
    needHypotheses,
    needTestPlans,
    readyForConclusion,
    topHypothesis: topHypothesis
      ? {
          id: topHypothesis.id,
          text: topHypothesis.text,
          confidence: topHypothesis.confidence ?? 0,
        }
      : undefined,
    hints,
  };
}
