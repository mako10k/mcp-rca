import type { McpServer } from "../framework/mcpServerKit.js";
import { registerStartInvestigationPrompt } from "./rca-start-investigation.js";
import { registerNextStepPrompt } from "./rca-next-step.js";
import { registerHypothesisGuidePrompt } from "./rca-hypothesis-guide.js";

/**
 * Register all prompts with the MCP server
 */
export async function registerPrompts(server: McpServer): Promise<void> {
  await registerStartInvestigationPrompt(server);
  await registerNextStepPrompt(server);
  await registerHypothesisGuidePrompt(server);
}
