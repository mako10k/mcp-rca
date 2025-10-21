# Copilot Instructions

- Read `AGENT.md` at the project root before making changes; it is the authoritative specification of the MCP server.
- Keep tool implementations aligned with the schemas defined in `src/tools/*.ts` and the capabilities described in `AGENT.md`.
- Use `npm run build` and `npm run test` to validate changes; do not rely on `npm run dev` when interacting with MCP clients because it emits non-JSON output.
- Prefer ASCII text in repository content unless an existing file intentionally uses other characters for a documented reason.
- When editing or referencing Markdown files (*.md), prefer using `#mcp_mdast_mdast-analyze` for structure analysis, `#mcp_mdast_mdast-query` for targeted queries/modifications, and `#mcp_mdast_mdast-transform` for complex transformations. These tools provide AST-based manipulation for more reliable and precise Markdown editing.
