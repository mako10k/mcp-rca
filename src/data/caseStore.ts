import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Case, Severity } from "../schema/case.js";

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

async function loadCases(): Promise<Case[]> {
  await ensureCasesFile();
  const raw = await readFile(getCasesFilePath(), "utf8");
  try {
    const data = JSON.parse(raw) as Case[];
    if (Array.isArray(data)) {
      return data;
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
    tags: input.tags,
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
