# AGENT.md — Root Cause Analysis MCP Server

Last updated: 2025-10-21

## Purpose
`mcp-rca` is a Model Context Protocol (MCP) server that assists incident root cause analysis. It provides tools covering the workflow from hypothesis generation to test planning, prioritization, and conclusion so that LLMs (and humans) can collaborate effectively.

## Implementation overview
- Language / runtime: TypeScript (ESM) on Node.js 20
- Protocol: `@modelcontextprotocol/sdk` (MCP 2025-06-18)
- Transport: stdio (newline-delimited JSON frames)
- Entry points: Server `dist/server.js` / CLI `dist/cli.js` (bin: `mcp-rca`)
- Dev hot-reload: `npm run dev` (tsx) — do not use via MCP clients because it writes non-JSON to stdout

## Capabilities
### Tools
> All listed tools are implemented (✅). Inputs/outputs are validated by Zod and returned as both `structuredContent` (JSON) and rendered text.

| Name | Role | Status | Key inputs | Metadata args (optional) | Key outputs |
|------|------|--------|------------|--------------------------|-------------|
| `case_create` | Create a new RCA case | ✅ | `title`, `severity`, `tags?` | `gitBranch`, `gitCommit`, `deployEnv` | `caseId`, `case` |
| `case_get` | Fetch a single case (optional paging for related objects) | ✅ | `caseId`, `include?`, `observationCursor?`, `observationLimit?` | — | `case`, `cursors?` |
| `case_list` | List/search cases (with paging) | ✅ | `query?`, `tags?`, `severity?`, `includeArchived?`, `pageSize?`, `cursor?` | — | `cases[]`, `nextCursor?`, `total?` |
| `case_update` | Update case metadata / archive management | ✅ | `caseId`, `title?`, `severity?`, `tags?`, `status?` | `gitBranch?`, `gitCommit?`, `deployEnv?` (nullable clears) | `case` |
| `observation_add` | Add an observation to a case | ✅ | `caseId`, `what`, `context?` | `gitBranch?`, `gitCommit?`, `deployEnv?` | `caseId`, `observation`, `case` |
| `observation_remove` | Remove an observation (soft delete) | ✅ | `caseId`, `observationId` | — | `caseId`, `observation`, `case` |
| `observation_update` | Update an observation | ✅ | `caseId`, `observationId`, `what?`, `context?` | `gitBranch?`, `gitCommit?`, `deployEnv?` (nullable clears) | `caseId`, `observation`, `case` |
| `hypothesis_propose` | Generate hypotheses (persist and return IDs; creates a draft test plan if provided by the generator) | ✅ | `caseId`, `text`, `rationale?`, `context?`, `logs?` | — | `hypotheses[]` (each includes `id`, `caseId`, `createdAt`, `updatedAt`, and optional minimal `testPlan`) |
| `hypothesis_update` | Update a hypothesis | ✅ | `caseId`, `hypothesisId`, `text?`, `rationale?`, `confidence?` | — | `hypothesis`, `case` |
| `hypothesis_remove` | Remove a hypothesis (and related test plans) | ✅ | `caseId`, `hypothesisId` | — | `hypothesis`, `case` |
| `hypothesis_finalize` | Finalize a hypothesis (sets `confidence` to 1.0) | ✅ | `caseId`, `hypothesisId` | — | `hypothesis`, `case` |
| `test_plan` | Create a verification plan | ✅ | `caseId`, `hypothesisId`, `method`, `expected`, `metric?` | `gitBranch?`, `gitCommit?`, `deployEnv?` | `testPlanId`, `status`, `notes` |
| `test_plan_update` | Update a test plan | ✅ | `caseId`, `testPlanId`, `method?`, `expected?`, `metric?`, `priority?` | `gitBranch?`, `gitCommit?`, `deployEnv?` (nullable clears) | `testPlan`, `case` |
| `test_plan_remove` | Remove a test plan | ✅ | `caseId`, `testPlanId` | — | `testPlan`, `case` |
| `test_prioritize` | Prioritize test plans (RICE/ICE) | ✅ | `strategy`, `items[]` | — | `ranked[]` |
| `bulk_delete_provisional` | Bulk delete provisional items (by confidence/priority thresholds) | ✅ | `caseId`, `confidenceThreshold?`, `priorityThreshold?` | — | `deletedHypotheses[]`, `deletedTestPlans[]`, `case` |
| `conclusion_finalize` | Finalize conclusion and follow-ups | ✅ | `caseId`, `rootCauses[]`, `fix`, `followUps?` | — | `conclusion` |

### Resources
| URI | Description |
|-----|-------------|
| `doc://mcp-rca/README` | Project README.md |
| `doc://mcp-rca/AGENT` | This document |
| `doc://mcp-rca/prompts/hypothesis` | Prompt template used for hypothesis generation |

The server supports `resources/listChanged`. `resources/subscribe` registers interest (events may be expanded later).

### Data storage
- Cases are persisted to `data/cases.json` relative to the project root.
- Override with the `MCP_RCA_CASES_PATH` environment variable for tests or custom deployments.
- Each case has a `status` (`active` / `archived`). Toggle via the `case_update` tool.

#### Multi-process considerations
**Important:** If you run multiple MCP server instances (e.g., VS Code integration + CLI scripts) without setting `MCP_RCA_CASES_PATH`, each process may resolve `data/cases.json` differently based on its working directory. This can cause data inconsistency where cases created in one context are invisible to another.

**Recommended setup:**
1. Set `MCP_RCA_CASES_PATH` to an absolute path in your MCP client configuration (e.g., `.vscode/mcp.json`):
   ```json
   {
     "mcpServers": {
       "mcp-rca": {
         "command": "node",
         "args": ["/absolute/path/to/mcp-rca/dist/server.js"],
         "env": {
           "MCP_RCA_CASES_PATH": "/absolute/path/to/mcp-rca/data/cases.json"
         }
       }
     }
   }
   ```
2. Or ensure all processes share the same working directory when launching the server.

The server logs the resolved cases path at startup (visible in stderr) to help diagnose path mismatches.

#### Git/Deploy metadata
- Case / Observation / TestPlan can carry the following optional fields:
  - `gitBranch`, `gitCommit`, `deployEnv`
- Where to set/update (nullable clears the field):
  - `case_create` / `case_update` — on the Case
  - `observation_add` / `observation_update` — on the Observation
  - `test_plan` / `test_plan_update` — on the TestPlan
- Persisted values are included in responses like `case_get` (omitted when unset).

### Typical workflow
1. Client sends `initialize`; the server negotiates the protocol version and returns capabilities.
2. `tools/list` returns 17 tools.
3. Run `hypothesis_propose` to generate and persist hypotheses; returned items include `id` for each hypothesis. If the generator provided a verification plan, an initial `test_plan` is created and its `testPlanId` is included. Then refine with `test_plan_update`, prioritize via `test_prioritize`, and finalize with `conclusion_finalize`.
4. Update/remove hypotheses and test plans using `hypothesis_update`, `hypothesis_remove`, `test_plan_update`, and `test_plan_remove`.
5. Finalize a high-confidence hypothesis via `hypothesis_finalize`.
6. Prune low-confidence/low-priority items via `bulk_delete_provisional`.
7. Use `resources/read` to fetch reference documentation at any time.

### Case-management design notes
- Minimize tool surface: case CRUD is consolidated into `case_create`, `case_get`, `case_list`, `case_update`. Deletion is soft via `case_update` with `status: "archived"`.
- `case_get`: requires `caseId`. If `include` contains `observations`, observations are returned with paging using `observationCursor` / `observationLimit` (default 20, max 100). A `cursors.nextObservationCursor?` is included when applicable.
- `case_list`: filtering via `query` (prefix match on title/tags), `tags` (AND), `severity`, `includeArchived`; paging with `pageSize` (default 20, max 50). Cursors are `base64(JSON.stringify({ offset, signature }))`; responses include `nextCursor` and `total` (capped at 1000).
- `case_update`: only provided fields are updated. Archived cases are hidden by default in `case_list` unless `includeArchived` is set.
- Observations: `observation_add` provides the create path; listing relies on `case_get` paging. Individual update/remove tools are implemented.
- Consistency: `updatedAt` is bumped after updates. Consider `case_listChanged` notifications for cache coherence (not implemented).

## Dev & ops notes
- Build: `npm run build`
- Start MCP server: `npm run start` or `node dist/server.js`
- Tests: `npm run test` (Vitest)
- Typecheck: `npm run typecheck`
- When invoked by an MCP client, always run the built bundle. `npm run dev` (tsx) writes to stdout and can break JSON framing.

## Logging & error handling
- All server logging must go through `src/logger.ts`, emitting structured JSON to stderr. Do not use `console.*` directly except for user-facing CLI help/version on stdout.
- During tool execution, include `level` / `component` / `requestId` / `message`.
- Send `tools/listChanged` / `resources/listChanged` notifications via the SDK when applicable.
  - Example: use `component: tool:case_create` and correlate using `requestId`.

(Implementation notes) Persistence and case-management tools are implemented. Resource registration includes robust fallback paths to account for packaged installs.

## Future work
- Case notes and related features
- Deeper LLM client integrations for hypothesis generation
- Evented updates via `resources/subscribe`
- Additional conclusion metadata (confidence, signatures)

Treat this document as the single source of truth for the current spec and keep it in sync with the implementation.
