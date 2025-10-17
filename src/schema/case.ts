import { Hypothesis, TestPlan } from "./hypothesis.js";
import { Conclusion, TestResult } from "./result.js";

export type Severity = "SEV1" | "SEV2" | "SEV3";
export type CaseStatus = "active" | "archived";

export interface Observation {
  id: string;
  caseId: string;
  what: string;
  context?: string;
  createdAt: string;
}

export interface Impact {
  id: string;
  caseId: string;
  metric: string;
  value: string;
  scope?: string;
  createdAt: string;
}

export interface Case {
  id: string;
  title: string;
  severity: Severity;
  tags: string[];
  status: CaseStatus;
  observations: Observation[];
  impacts: Impact[];
  hypotheses: Hypothesis[];
  tests: TestPlan[];
  results: TestResult[];
  conclusion?: Conclusion;
  createdAt: string;
  updatedAt: string;
}
