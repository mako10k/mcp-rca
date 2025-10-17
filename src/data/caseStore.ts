import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Case, CaseStatus, Observation, Severity } from "../schema/case.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function getCasesFilePath(): string {
  const override = process.env.MCP_RCA_CASES_PATH;
  if (override && override.trim().length > 0) {
    return override;
  }
  return resolve(__dirname, "../../data/cases.json");
}

async function ensureCasesFile(): Promise<void> {
  const filePath = getCasesFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeFile(filePath, "[]", "utf8");
    } else {
      throw error;
    }
  }
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
  await ensureCasesFile();
  const raw = await readFile(getCasesFilePath(), "utf8");
  try {
    const data = JSON.parse(raw) as Array<Partial<Case> & { id: string; title: string; severity: Severity }>;
    if (Array.isArray(data)) {
      return data.map((entry) => normalizeCase(entry));
    }
  } catch (error) {
    console.error("Failed to parse cases.json; resetting store", error);
  }
  await writeFile(getCasesFilePath(), "[]", "utf8");
  return [];
}

async function saveCases(cases: Case[]): Promise<void> {
  const serialized = JSON.stringify(cases, null, 2);
  await writeFile(getCasesFilePath(), `${serialized}\n`, "utf8");
}

export interface CreateCaseInput {
  title: string;
  severity: Severity;
  tags: string[];
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
    updatedAt: now,
  };

  cases[index] = updated;
  await saveCases(cases);

  return { case: updated };
}
