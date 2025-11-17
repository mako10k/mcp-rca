# mcp-rca

Root Cause Analysis MCP server that helps SRE teams structure observations, hypotheses, and test plans while collaborating with an LLM.

## Highlights

- **Prompt-based guidance**: MCP prompts guide the LLM through each RCA phase
  - `rca_start_investigation` - Begin investigation with structured initial steps
  - `rca_next_step` - Get context-aware recommendations based on case state
  - `rca_hypothesis_propose` - Generate testable root cause hypotheses
  - `rca_verification_planning` - Create effective test plans
  - `rca_conclusion_guide` - Document conclusions with root causes and follow-ups
- **LLM-oriented tools**: Guidance tools provide best practices and phase-specific checklists
  - `guidance_best_practices` - RCA principles and anti-patterns
  - `guidance_phase` - Phase-specific steps and red flags
  - `guidance_prompt_scaffold` - Structured output formats for tasks
  - `guidance_followups` - Post-conclusion follow-up actions
  - `guidance_prompts_catalog` - Discover available prompts
  - `guidance_tools_catalog` - Comprehensive tool catalog with workflow guidance
- **Hypothesis generation** returns persisted objects with IDs
  - `hypothesis_propose` persists generated hypotheses and returns each item with `id`, `caseId`, `createdAt`, and `updatedAt`.
  - When the generator supplies a verification plan in its output, an initial `test_plan_create` is called automatically and minimal info is attached to the hypothesis (method/expected/metric?).
- **Git/deploy metadata** on Case / Observation / TestPlan
  - Optional fields: `gitBranch`, `gitCommit`, `deployEnv`.
  - Set on create and update tools; passing `null` on update clears the field.

## Installation

```bash
npm install mcp-rca
```

To launch the server directly as a CLI:

```bash
npx mcp-rca
```

The server communicates over stdio and can be attached to any MCP-compatible client. CLI flags include `--help` (`-h`) for usage and `--version` (`-v`) to print the current release.

## Getting Started (Development)

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/mako10k/mcp-rca.git
   cd mcp-rca
   npm install
   ```
2. Launch the developer server with hot reloading:
   ```bash
   npm run dev
   ```
3. Produce a production bundle (emits `dist/` and copies prompt assets):
   ```bash
   npm run build
   ```

## Project Layout

```
src/
  framework/         # Local stub for MCP server lifecycle
  server.ts          # MCP server entrypoint
  schema/            # TypeScript data models
  tools/             # Tool handlers surfaced to MCP clients
  llm/               # Prompt assets and LLM utilities
data/
  .gitkeep           # Runtime storage directory (cases.json generated at runtime)
scripts/
  copy-assets.mjs    # Copies static prompt assets into dist/ post-build
```

Refer to `AGENT.md` for the full specification, roadmap, and design guidelines.

## Quick Start: Using Prompts

MCP prompts guide your investigation through each phase:

### 1. Start Investigation
```
Use prompt: rca_start_investigation
→ Creates a structured plan for case creation and initial observations
```

### 2. Track Progress
```
Use prompt: rca_next_step with caseId
→ Analyzes current state and suggests next actions
```

### 3. Generate Hypotheses
```
Use prompt: rca_hypothesis_propose with caseId
→ Guides hypothesis generation with best practices
→ Then call tool: hypothesis_propose to create and persist hypotheses
```

### 4. Plan Verification
```
Use prompt: rca_verification_planning with caseId, hypothesisId, hypothesisText
→ Provides test plan templates and prioritization guidance
→ Then call tool: test_plan_create to create verification plans
```

### 5. Document Conclusion
```
Use prompt: rca_conclusion_guide with caseId
→ Guides documentation of root causes, fixes, and follow-ups
→ Then call tool: conclusion_finalize to close the case
```

### LLM Guidance Tools

Call guidance tools at any time for additional support:
- `guidance_best_practices` - Core RCA principles
- `guidance_phase` - Phase-specific checklists (observation/hypothesis/testing/conclusion)
- `guidance_prompt_scaffold` - Output format templates for specific tasks
- `guidance_followups` - Prevention and follow-up suggestions

## MCP Tool Highlights

### hypothesis_propose

Input (summary):

```json
{
  "caseId": "case_...",
  "text": "Short incident summary",
  "rationale": "Optional background",
  "context": { "service": "api", "region": "us-east-1" },
  "logs": "... optional log snippets ..."
}
```

Output (each hypothesis is persisted and includes identifiers; an initial test plan may be present if provided by the generator):

```json
{
  "hypotheses": [
    {
      "id": "hyp_...",
      "caseId": "case_...",
      "text": "Cache node eviction storm caused by oversized payloads",
      "rationale": "Spike correlates with payload growth and cache TTL",
      "createdAt": "2025-10-21T00:00:00.000Z",
      "updatedAt": "2025-10-21T00:00:00.000Z",
      "testPlan": {
        "id": "tp_...",          
        "hypothesisId": "hyp_...",
        "method": "Reproduce with oversized payloads and inspect eviction rate",
        "expected": "Evictions rise sharply with payload size > X",
        "metric": "cache.evictions"
      }
    }
  ]
}
```

### Metadata arguments (git/deploy)

The following tools accept optional metadata fields; on update, `null` clears the field.

- Case
  - `case_create`: `gitBranch`, `gitCommit`, `deployEnv`
  - `case_update`: `gitBranch?`, `gitCommit?`, `deployEnv?` (nullable clears)
- Observation
  - `observation_add`: `gitBranch?`, `gitCommit?`, `deployEnv?`
  - `observation_update`: `gitBranch?`, `gitCommit?`, `deployEnv?` (nullable clears)
- Test Plan
  - `test_plan_create`: `gitBranch?`, `gitCommit?`, `deployEnv?`
  - `test_plan_update`: `gitBranch?`, `gitCommit?`, `deployEnv?` (nullable clears)

Example update payload that clears `gitCommit` on an observation:

```json
{
  "caseId": "case_...",
  "observationId": "obs_...",
  "gitCommit": null
}
```

Responses include the persisted metadata when set; fields are omitted when unset.

## Performance & Best Practices

### Token Optimization

Many mutation tools (e.g., `observation_add`, `hypothesis_update`) return the complete `case` object in their responses, which can consume thousands of tokens per operation.

**Recommended pattern:**
```javascript
// Perform mutations without relying on the case field
await observation_add({ caseId, what: "..." });
await observation_add({ caseId, what: "..." });

// Fetch case data selectively when needed
const caseData = await case_get({
  caseId,
  include: ['observations'],  // Only fetch what you need
});
```

See [docs/API_RESPONSE_OPTIMIZATION.md](docs/API_RESPONSE_OPTIMIZATION.md) for detailed optimization strategies and token savings examples.

## License

This project is released under the MIT License. See the `LICENSE` file for details.

## Publishing

The package is configured for the public npm registry. After bumping the version, run:

```bash
npm publish --access public
```

`prepublishOnly` rebuilds TypeScript sources and copies required assets before the tarball is generated.
