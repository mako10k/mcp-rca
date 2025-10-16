export interface TestResult {
  id: string;
  testPlanId: string;
  observed: string;
  metrics?: Record<string, number | string>;
  createdAt: string;
  updatedAt: string;
}

export interface Conclusion {
  id: string;
  caseId: string;
  rootCauses: string[];
  fix: string;
  followUps?: string[];
  createdAt: string;
  updatedAt: string;
  confidenceMarker?: "🟢" | "🔵" | "🟡" | "🔴";
}
