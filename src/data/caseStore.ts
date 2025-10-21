import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { JSONFilePreset } from "lowdb/node";
import type { Case, CaseStatus, Observation, Severity } from "../schema/case.js";
import type { Hypothesis, TestPlan } from "../schema/hypothesis.js";
import { logger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getProjectRoot(): string {
  // Assume dist/data/caseStore.js → resolve to project root (../../)
  // Or if running from src directly (tsx/dev), go up one level
  const fromDist = resolve(__dirname, "../..");
  const fromSrc = resolve(__dirname, "..");
  
  // Heuristic: check if package.json exists at the candidate root
  if (existsSync(resolve(fromDist, "package.json"))) {
    return fromDist;
  }
  if (existsSync(resolve(fromSrc, "package.json"))) {
    return fromSrc;
  }
  
  // Default to fromDist for built bundle
  return fromDist;
}

function getCasesFilePath(): string {
  const override = process.env.MCP_RCA_CASES_PATH;
  if (override && override.trim().length > 0) {
    logger.info("Using custom cases path from MCP_RCA_CASES_PATH", "caseStore", { path: override });
    return override;
  }
  
  const projectRoot = getProjectRoot();
  const defaultPath = resolve(projectRoot, "data", "cases.json");
  
  logger.info("Using default cases path", "caseStore", { path: defaultPath, projectRoot });
  return defaultPath;
}

type DbSchema = { cases: Case[] };

let dbInstance: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>> | null = null;

async function getDb() {
  if (!dbInstance) {
    const filePath = getCasesFilePath();
    dbInstance = await JSONFilePreset<DbSchema>(filePath, { cases: [] });
    
    // Ensure data structure is initialized
    if (!dbInstance.data) {
      dbInstance.data = { cases: [] };
    }
    if (!Array.isArray(dbInstance.data.cases)) {
      dbInstance.data.cases = [];
    }
  }
  return dbInstance;
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) {
    return [];
  }
  const trimmed = tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  const unique = Array.from(new Set(trimmed));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

function normalizeCase(record: Partial<Case> & { id: string; title: string; severity: Severity }): Case {
  const observations = Array.isArray(record.observations) ? record.observations : [];
  const impacts = Array.isArray(record.impacts) ? record.impacts : [];
  const hypotheses = Array.isArray(record.hypotheses) ? record.hypotheses : [];
  const tests = Array.isArray(record.tests) ? record.tests : [];
  const results = Array.isArray(record.results) ? record.results : [];

  return {
    id: record.id,
    title: record.title,
    severity: record.severity,
    tags: normalizeTags(record.tags),
    status: record.status ?? "active",
    gitBranch: record.gitBranch,
    gitCommit: record.gitCommit,
    deployEnv: record.deployEnv,
    observations,
    impacts,
    hypotheses,
    tests,
    results,
    conclusion: record.conclusion,
    createdAt: record.createdAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? record.createdAt ?? new Date().toISOString(),
  };
}

async function loadCases(): Promise<Case[]> {
  const db = await getDb();
  await db.read();
  const cases = db.data.cases || [];
  return cases.map((entry) => normalizeCase(entry as Partial<Case> & { id: string; title: string; severity: Severity }));
}

async function saveCases(cases: Case[]): Promise<void> {
  const db = await getDb();
  db.data.cases = cases;
  await db.write();
}

export interface CreateCaseInput {
  title: string;
  severity: Severity;
  tags: string[];
  gitBranch?: string;
  gitCommit?: string;
  deployEnv?: string;
}

export interface CreateCaseResult {
  case: Case;
}

export async function createCase(input: CreateCaseInput): Promise<CreateCaseResult> {
  const now = new Date().toISOString();
  const id = `case_${randomUUID()}`;

  const newCase: Case = {
    id,
    title: input.title,
    severity: input.severity,
    tags: normalizeTags(input.tags),
    status: "active",
    gitBranch: input.gitBranch,
    gitCommit: input.gitCommit,
    deployEnv: input.deployEnv,
    observations: [],
    impacts: [],
    hypotheses: [],
    tests: [],
    results: [],
    createdAt: now,
    updatedAt: now,
  };

  const cases = await loadCases();
  cases.push(newCase);
  await saveCases(cases);

  return { case: newCase };
}

export interface AddObservationInput {
  caseId: string;
  what: string;
  context?: string;
  gitBranch?: string;
  gitCommit?: string;
  deployEnv?: string;
}

export interface AddObservationResult {
  observation: Observation;
  case: Case;
}

export async function addObservation(
  input: AddObservationInput,
): Promise<AddObservationResult> {
  const cases = await loadCases();
  const index = cases.findIndex((item) => item.id === input.caseId);

  if (index === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const now = new Date().toISOString();
  const normalizedContext = input.context?.trim() ?? undefined;

  const observation: Observation = {
    id: `obs_${randomUUID()}`,
    caseId: input.caseId,
    what: input.what,
    context: normalizedContext && normalizedContext.length > 0 ? normalizedContext : undefined,
    gitBranch: input.gitBranch,
    gitCommit: input.gitCommit,
    deployEnv: input.deployEnv,
    createdAt: now,
  };

  const updatedCase: Case = {
    ...cases[index],
    observations: [...cases[index].observations, observation],
    updatedAt: now,
  };

  cases[index] = updatedCase;
  await saveCases(cases);

  return { observation, case: updatedCase };
}

export interface AddHypothesisInput {
  caseId: string;
  text: string;
  rationale?: string;
  confidence?: number;
}

export interface AddHypothesisResult {
  hypothesis: Hypothesis;
  case: Case;
}

export async function addHypothesis(
  input: AddHypothesisInput,
): Promise<AddHypothesisResult> {
  const cases = await loadCases();
  const index = cases.findIndex((item) => item.id === input.caseId);

  if (index === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const now = new Date().toISOString();
  const normalizedRationale = input.rationale?.trim() ?? undefined;

  const hypothesis: Hypothesis = {
    id: `hyp_${randomUUID()}`,
    caseId: input.caseId,
    text: input.text,
    rationale: normalizedRationale && normalizedRationale.length > 0 ? normalizedRationale : undefined,
    confidence: input.confidence,
    createdAt: now,
    updatedAt: now,
  };

  const updatedCase: Case = {
    ...cases[index],
    hypotheses: [...cases[index].hypotheses, hypothesis],
    updatedAt: now,
  };

  cases[index] = updatedCase;
  await saveCases(cases);

  return { hypothesis, case: updatedCase };
}

export interface RemoveObservationInput {
  caseId: string;
  observationId: string;
}

export interface RemoveObservationResult {
  observation: Observation;
  case: Case;
}

export async function removeObservation(
  input: RemoveObservationInput,
): Promise<RemoveObservationResult> {
  const cases = await loadCases();
  const index = cases.findIndex((item) => item.id === input.caseId);

  if (index === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const observationIndex = cases[index].observations.findIndex(
    (item) => item.id === input.observationId,
  );

  if (observationIndex === -1) {
    throw new Error(`Observation ${input.observationId} not found in case ${input.caseId}`);
  }

  const [removedObservation] = cases[index].observations.splice(observationIndex, 1);
  const now = new Date().toISOString();

  const updatedCase: Case = {
    ...cases[index],
    observations: [...cases[index].observations],
    updatedAt: now,
  };

  cases[index] = updatedCase;
  await saveCases(cases);

  return {
    observation: removedObservation,
    case: updatedCase,
  };
}

export interface UpdateObservationInput {
  caseId: string;
  observationId: string;
  what?: string;
  context?: string | null;
  gitBranch?: string | null;
  gitCommit?: string | null;
  deployEnv?: string | null;
}

export interface UpdateObservationResult {
  observation: Observation;
  case: Case;
}

export async function updateObservation(
  input: UpdateObservationInput,
): Promise<UpdateObservationResult> {
  const cases = await loadCases();
  const caseIndex = cases.findIndex((item) => item.id === input.caseId);

  if (caseIndex === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const observationIndex = cases[caseIndex].observations.findIndex(
    (item) => item.id === input.observationId,
  );

  if (observationIndex === -1) {
    throw new Error(`Observation ${input.observationId} not found in case ${input.caseId}`);
  }

  const original = cases[caseIndex].observations[observationIndex];

  const updatedObservation: Observation = {
    ...original,
    what: input.what !== undefined && input.what.trim().length > 0 ? input.what.trim() : original.what,
    context:
      input.context !== undefined
        ? input.context === null || input.context.trim().length === 0
          ? undefined
          : input.context.trim()
        : original.context,
    gitBranch:
      input.gitBranch !== undefined
        ? input.gitBranch === null || input.gitBranch.trim().length === 0
          ? undefined
          : input.gitBranch.trim()
        : original.gitBranch,
    gitCommit:
      input.gitCommit !== undefined
        ? input.gitCommit === null || input.gitCommit.trim().length === 0
          ? undefined
          : input.gitCommit.trim()
        : original.gitCommit,
    deployEnv:
      input.deployEnv !== undefined
        ? input.deployEnv === null || input.deployEnv.trim().length === 0
          ? undefined
          : input.deployEnv.trim()
        : original.deployEnv,
  };

  const now = new Date().toISOString();
  const updatedCase: Case = {
    ...cases[caseIndex],
    observations: cases[caseIndex].observations.map((item, idx) =>
      idx === observationIndex ? updatedObservation : item,
    ),
    updatedAt: now,
  };

  cases[caseIndex] = updatedCase;
  await saveCases(cases);

  return {
    observation: updatedObservation,
    case: updatedCase,
  };
}

export interface GetCaseResult {
  case: Case;
}

export async function getCase(caseId: string): Promise<GetCaseResult | null> {
  const cases = await loadCases();
  const found = cases.find((item) => item.id === caseId);
  if (!found) {
    return null;
  }
  return { case: found };
}

export interface ListCasesFilters {
  query?: string;
  tags?: string[];
  severity?: Severity;
  includeArchived?: boolean;
}

export interface ListCasesOptions extends ListCasesFilters {
  pageSize?: number;
  cursor?: string;
}

export interface CaseSummary {
  id: string;
  title: string;
  severity: Severity;
  status: CaseStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  observationCount: number;
}

export interface ListCasesResult {
  cases: CaseSummary[];
  nextCursor?: string;
  total: number;
}

const MAX_LIST_TOTAL = 1000;

interface CursorPayload {
  offset: number;
  signature: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as CursorPayload;
    if (typeof parsed?.offset === "number" && typeof parsed?.signature === "string") {
      return parsed;
    }
  } catch {
    // ignore malformed cursor
  }
  return null;
}

function createFilterSignature(filters: ListCasesFilters): string {
  const normalizedTags = filters.tags ? [...filters.tags].sort() : undefined;
  return JSON.stringify({
    query: filters.query ?? null,
    tags: normalizedTags ?? null,
    severity: filters.severity ?? null,
    includeArchived: filters.includeArchived ?? false,
  });
}

export async function listCases(options: ListCasesOptions = {}): Promise<ListCasesResult> {
  const cases = await loadCases();
  const filters: ListCasesFilters = {
    query: options.query?.trim().toLowerCase() || undefined,
    tags: options.tags?.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0),
    severity: options.severity,
    includeArchived: options.includeArchived ?? false,
  };

  const filtered = cases.filter((item) => {
    if (!filters.includeArchived && item.status === "archived") {
      return false;
    }
    if (filters.severity && item.severity !== filters.severity) {
      return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      const caseTags = item.tags.map((tag) => tag.toLowerCase());
      const hasAllTags = filters.tags.every((tag) => caseTags.some((caseTag) => caseTag.startsWith(tag)));
      if (!hasAllTags) {
        return false;
      }
    }
    if (filters.query) {
      const normalizedTitle = item.title.toLowerCase();
      const tagMatches = item.tags.some((tag) => tag.toLowerCase().startsWith(filters.query!));
      if (!normalizedTitle.startsWith(filters.query) && !tagMatches) {
        return false;
      }
    }
    return true;
  });

  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 50);
  const signature = createFilterSignature(filters);
  let offset = 0;
  if (options.cursor) {
    const payload = decodeCursor(options.cursor);
    if (payload && payload.signature === signature) {
      offset = Math.max(payload.offset, 0);
    }
  }

  const slice = filtered.slice(offset, offset + pageSize);

  const summaries: CaseSummary[] = slice.map((item) => ({
    id: item.id,
    title: item.title,
    severity: item.severity,
    status: item.status,
    tags: item.tags,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    observationCount: item.observations.length,
  }));

  const nextOffset = offset + pageSize;
  const nextCursor = nextOffset < filtered.length ? encodeCursor({ offset: nextOffset, signature }) : undefined;

  const total = filtered.length > MAX_LIST_TOTAL ? MAX_LIST_TOTAL : filtered.length;

  return {
    cases: summaries,
    nextCursor,
    total,
  };
}

export interface UpdateCaseInput {
  caseId: string;
  title?: string;
  severity?: Severity;
  tags?: string[];
  status?: CaseStatus;
  gitBranch?: string | null;
  gitCommit?: string | null;
  deployEnv?: string | null;
}

export interface UpdateCaseResult {
  case: Case;
}

export async function updateCase(input: UpdateCaseInput): Promise<UpdateCaseResult> {
  const cases = await loadCases();
  const index = cases.findIndex((item) => item.id === input.caseId);
  if (index === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const now = new Date().toISOString();
  const current = cases[index];

  const updated: Case = {
    ...current,
    title: input.title?.trim().length ? input.title.trim() : current.title,
    severity: input.severity ?? current.severity,
    tags: input.tags ? normalizeTags(input.tags) : current.tags,
    status: input.status ?? current.status,
    gitBranch: input.gitBranch !== undefined ? (input.gitBranch === null || input.gitBranch.trim().length === 0 ? undefined : input.gitBranch.trim()) : current.gitBranch,
    gitCommit: input.gitCommit !== undefined ? (input.gitCommit === null || input.gitCommit.trim().length === 0 ? undefined : input.gitCommit.trim()) : current.gitCommit,
    deployEnv: input.deployEnv !== undefined ? (input.deployEnv === null || input.deployEnv.trim().length === 0 ? undefined : input.deployEnv.trim()) : current.deployEnv,
    updatedAt: now,
  };

  cases[index] = updated;
  await saveCases(cases);

  return { case: updated };
}

export interface UpdateHypothesisInput {
  caseId: string;
  hypothesisId: string;
  text?: string;
  rationale?: string | null;
  confidence?: number | null;
}

export interface UpdateHypothesisResult {
  hypothesis: Hypothesis;
  case: Case;
}

export async function updateHypothesis(
  input: UpdateHypothesisInput,
): Promise<UpdateHypothesisResult> {
  const cases = await loadCases();
  const caseIndex = cases.findIndex((item) => item.id === input.caseId);

  if (caseIndex === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const hypothesisIndex = cases[caseIndex].hypotheses.findIndex(
    (item) => item.id === input.hypothesisId,
  );

  if (hypothesisIndex === -1) {
    throw new Error(`Hypothesis ${input.hypothesisId} not found in case ${input.caseId}`);
  }

  const original = cases[caseIndex].hypotheses[hypothesisIndex];

  const updatedHypothesis: Hypothesis = {
    ...original,
    text: input.text !== undefined && input.text.trim().length > 0 ? input.text.trim() : original.text,
    rationale:
      input.rationale !== undefined
        ? input.rationale === null || input.rationale.trim().length === 0
          ? undefined
          : input.rationale.trim()
        : original.rationale,
    confidence: input.confidence !== undefined ? (input.confidence === null ? undefined : input.confidence) : original.confidence,
    updatedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  const updatedCase: Case = {
    ...cases[caseIndex],
    hypotheses: cases[caseIndex].hypotheses.map((item, idx) =>
      idx === hypothesisIndex ? updatedHypothesis : item,
    ),
    updatedAt: now,
  };

  cases[caseIndex] = updatedCase;
  await saveCases(cases);

  return {
    hypothesis: updatedHypothesis,
    case: updatedCase,
  };
}

export interface RemoveHypothesisInput {
  caseId: string;
  hypothesisId: string;
}

export interface RemoveHypothesisResult {
  hypothesis: Hypothesis;
  case: Case;
}

export async function removeHypothesis(
  input: RemoveHypothesisInput,
): Promise<RemoveHypothesisResult> {
  const cases = await loadCases();
  const index = cases.findIndex((item) => item.id === input.caseId);

  if (index === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const hypothesisIndex = cases[index].hypotheses.findIndex(
    (item) => item.id === input.hypothesisId,
  );

  if (hypothesisIndex === -1) {
    throw new Error(`Hypothesis ${input.hypothesisId} not found in case ${input.caseId}`);
  }

  const [removedHypothesis] = cases[index].hypotheses.splice(hypothesisIndex, 1);
  const now = new Date().toISOString();

  const updatedCase: Case = {
    ...cases[index],
    hypotheses: [...cases[index].hypotheses],
    // Also remove related test plans
    tests: cases[index].tests.filter((test) => test.hypothesisId !== input.hypothesisId),
    updatedAt: now,
  };

  cases[index] = updatedCase;
  await saveCases(cases);

  return {
    hypothesis: removedHypothesis,
    case: updatedCase,
  };
}

export interface UpdateTestPlanInput {
  caseId: string;
  testPlanId: string;
  method?: string;
  expected?: string;
  metric?: string | null;
  priority?: number | null;
  gitBranch?: string | null;
  gitCommit?: string | null;
  deployEnv?: string | null;
}

export interface UpdateTestPlanResult {
  testPlan: TestPlan;
  case: Case;
}

export async function updateTestPlan(
  input: UpdateTestPlanInput,
): Promise<UpdateTestPlanResult> {
  const cases = await loadCases();
  const caseIndex = cases.findIndex((item) => item.id === input.caseId);

  if (caseIndex === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const testPlanIndex = cases[caseIndex].tests.findIndex(
    (item) => item.id === input.testPlanId,
  );

  if (testPlanIndex === -1) {
    throw new Error(`Test plan ${input.testPlanId} not found in case ${input.caseId}`);
  }

  const original = cases[caseIndex].tests[testPlanIndex];

  const updatedTestPlan: TestPlan = {
    ...original,
    method: input.method !== undefined && input.method.trim().length > 0 ? input.method.trim() : original.method,
    expected: input.expected !== undefined && input.expected.trim().length > 0 ? input.expected.trim() : original.expected,
    metric:
      input.metric !== undefined
        ? input.metric === null || input.metric.trim().length === 0
          ? undefined
          : input.metric.trim()
        : original.metric,
    priority: input.priority !== undefined ? (input.priority === null ? undefined : input.priority) : original.priority,
    gitBranch:
      input.gitBranch !== undefined
        ? input.gitBranch === null || input.gitBranch.trim().length === 0
          ? undefined
          : input.gitBranch.trim()
        : original.gitBranch,
    gitCommit:
      input.gitCommit !== undefined
        ? input.gitCommit === null || input.gitCommit.trim().length === 0
          ? undefined
          : input.gitCommit.trim()
        : original.gitCommit,
    deployEnv:
      input.deployEnv !== undefined
        ? input.deployEnv === null || input.deployEnv.trim().length === 0
          ? undefined
          : input.deployEnv.trim()
        : original.deployEnv,
    updatedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  const updatedCase: Case = {
    ...cases[caseIndex],
    tests: cases[caseIndex].tests.map((item, idx) =>
      idx === testPlanIndex ? updatedTestPlan : item,
    ),
    updatedAt: now,
  };

  cases[caseIndex] = updatedCase;
  await saveCases(cases);

  return {
    testPlan: updatedTestPlan,
    case: updatedCase,
  };
}

export interface RemoveTestPlanInput {
  caseId: string;
  testPlanId: string;
}

export interface RemoveTestPlanResult {
  testPlan: TestPlan;
  case: Case;
}

export async function removeTestPlan(
  input: RemoveTestPlanInput,
): Promise<RemoveTestPlanResult> {
  const cases = await loadCases();
  const index = cases.findIndex((item) => item.id === input.caseId);

  if (index === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const testPlanIndex = cases[index].tests.findIndex(
    (item) => item.id === input.testPlanId,
  );

  if (testPlanIndex === -1) {
    throw new Error(`Test plan ${input.testPlanId} not found in case ${input.caseId}`);
  }

  const [removedTestPlan] = cases[index].tests.splice(testPlanIndex, 1);
  const now = new Date().toISOString();

  const updatedCase: Case = {
    ...cases[index],
    tests: [...cases[index].tests],
    updatedAt: now,
  };

  cases[index] = updatedCase;
  await saveCases(cases);

  return {
    testPlan: removedTestPlan,
    case: updatedCase,
  };
}

export interface FinalizeHypothesisInput {
  caseId: string;
  hypothesisId: string;
}

export interface FinalizeHypothesisResult {
  hypothesis: Hypothesis;
  case: Case;
}

export async function finalizeHypothesis(
  input: FinalizeHypothesisInput,
): Promise<FinalizeHypothesisResult> {
  // Finalize by setting confidence to 1.0
  return updateHypothesis({
    caseId: input.caseId,
    hypothesisId: input.hypothesisId,
    confidence: 1.0,
  });
}

export interface BulkDeleteProvisionalInput {
  caseId: string;
  confidenceThreshold?: number; // Default 0.5
  priorityThreshold?: number; // Default 3
}

export interface AddTestPlanInput {
  caseId: string;
  hypothesisId: string;
  method: string;
  expected: string;
  metric?: string;
  gitBranch?: string;
  gitCommit?: string;
  deployEnv?: string;
}

export interface AddTestPlanResult {
  testPlan: TestPlan;
  case: Case;
}

export async function addTestPlan(
  input: AddTestPlanInput,
): Promise<AddTestPlanResult> {
  const cases = await loadCases();
  const index = cases.findIndex((item) => item.id === input.caseId);

  if (index === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  // Verify hypothesis exists
  const hypothesisExists = cases[index].hypotheses.some((h) => h.id === input.hypothesisId);
  if (!hypothesisExists) {
    throw new Error(`Hypothesis ${input.hypothesisId} not found in case ${input.caseId}`);
  }

  const now = new Date().toISOString();
  const normalizedMetric = input.metric?.trim() ?? undefined;

  const testPlan: TestPlan = {
    id: `tp_${randomUUID()}`,
    caseId: input.caseId,
    hypothesisId: input.hypothesisId,
    method: input.method,
    expected: input.expected,
    metric: normalizedMetric && normalizedMetric.length > 0 ? normalizedMetric : undefined,
    gitBranch: input.gitBranch,
    gitCommit: input.gitCommit,
    deployEnv: input.deployEnv,
    createdAt: now,
    updatedAt: now,
  };

  const updatedCase: Case = {
    ...cases[index],
    tests: [...cases[index].tests, testPlan],
    updatedAt: now,
  };

  cases[index] = updatedCase;
  await saveCases(cases);

  return { testPlan, case: updatedCase };
}

export interface BulkDeleteProvisionalResult {
  deletedHypotheses: Hypothesis[];
  deletedTestPlans: TestPlan[];
  case: Case;
}

export async function bulkDeleteProvisional(
  input: BulkDeleteProvisionalInput,
): Promise<BulkDeleteProvisionalResult> {
  const cases = await loadCases();
  const index = cases.findIndex((item) => item.id === input.caseId);

  if (index === -1) {
    throw new Error(`Case ${input.caseId} not found`);
  }

  const confidenceThreshold = input.confidenceThreshold ?? 0.5;
  const priorityThreshold = input.priorityThreshold ?? 3;

  const deletedHypotheses: Hypothesis[] = [];
  const deletedTestPlans: TestPlan[] = [];

  // Filter hypotheses to delete: confidence < threshold or confidence is null
  const remainingHypotheses = cases[index].hypotheses.filter((hyp) => {
    const shouldDelete = (hyp.confidence ?? 0) < confidenceThreshold;
    if (shouldDelete) {
      deletedHypotheses.push(hyp);
    }
    return !shouldDelete;
  });

  // Filter test plans to delete: priority > threshold or priority is null, or related hypothesis is deleted
  const deletedHypothesisIds = new Set(deletedHypotheses.map(h => h.id));
  const remainingTestPlans = cases[index].tests.filter((test) => {
    const shouldDelete = (test.priority ?? 0) > priorityThreshold || deletedHypothesisIds.has(test.hypothesisId);
    if (shouldDelete) {
      deletedTestPlans.push(test);
    }
    return !shouldDelete;
  });

  const now = new Date().toISOString();
  const updatedCase: Case = {
    ...cases[index],
    hypotheses: remainingHypotheses,
    tests: remainingTestPlans,
    updatedAt: now,
  };

  cases[index] = updatedCase;
  await saveCases(cases);

  return {
    deletedHypotheses,
    deletedTestPlans,
    case: updatedCase,
  };
}
