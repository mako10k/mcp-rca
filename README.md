# mcp-rca

Root Cause Analysis MCP server that helps SRE teams structure observations, hypotheses, and test plans while collaborating with an LLM.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Launch the developer server:
   ```bash
   npm run dev
   ```
3. Build for production:
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
  cases.sqlite       # Placeholder persistence layer
```

Refer to `AGENT.md` for the full specification, roadmap, and design guidelines.
