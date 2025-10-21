export interface Hypothesis {
  id: string;
  caseId: string;
  text: string;
  rationale?: string;
  confidence?: number; // 0-1 float, optional until scoring logic exists
  createdAt: string;
  updatedAt: string;
}

export interface TestPlan {
  id: string;
  caseId: string;
  hypothesisId: string;
  method: string;
  expected: string;
  metric?: string;
  priority?: number;
  // Optional association metadata
  gitBranch?: string;
  gitCommit?: string;
  deployEnv?: string;
  createdAt: string;
  updatedAt: string;
}
