# Release Notes

## v0.4.0 - 2025-11-17

### Added
- `observations_list` tool for filtered and paginated observation queries without loading full cases
- Prompt catalog entries now expose default templates so MCP clients can render guidance inline

### Changed
- `case_get` reports observation pagination metadata and documents default `include` behaviour for lean payloads
- Reference docs expanded with response optimization and pagination walkthroughs for MCP implementers

### Testing
- `npm run test` (Vitest) covers the new guidance catalog fields and observation pagination flows
