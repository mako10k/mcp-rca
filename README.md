# mcp-rca

Root Cause Analysis MCP server that helps SRE teams structure observations, hypotheses, and test plans while collaborating with an LLM.

## Installation

```bash
npm install mcp-rca
```

To launch the server directly as a CLI:

```bash
npx mcp-rca
```

The server communicates over stdio and can be attached to any MCP-compatible client.

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

## Publishing

The package is configured for the public npm registry. After bumping the version, run:

```bash
npm publish --access public
```

`prepublishOnly` rebuilds TypeScript sources and copies required assets before the tarball is generated.
