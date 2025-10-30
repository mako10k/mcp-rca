import type { McpServer } from "../framework/mcpServerKit.js";
import { z } from "zod";
import { render } from "../prompt-helpers/template-renderer.js";

const CONCLUSION_GUIDE_TEMPLATE = `## RCA Conclusion Summary

### Elements to Include in Conclusion

#### 1. Root Causes (rootCauses)
List of confirmed root causes:
- Clearly describe technical causes
- Dig deep to "why it happened" level
- List all causes if multiple exist

Examples:
- "Database connection pool max size was insufficient for peak load"
- "Memory leak in recent deploy causing gradual OOM"
- "Configuration mismatch between service A and service B after upgrade"

#### 2. Implemented Fix (fix)
Actions taken to resolve the issue:
- **Emergency response** (rollback, scale-up, etc.)
- **Permanent fix** (code changes, config updates, etc.)
- **Timing and verification** of applied fixes

Example:
"Rolled back to previous version at 14:30 UTC. Error rate dropped to 0% within 5 minutes. Applied permanent fix (increased connection pool to 200, timeout to 5s) at 16:00 UTC. Verified with load test showing stable performance under peak conditions."

#### 3. Follow-up Actions (followUps)
Actions to prevent recurrence:
- Add monitoring and alerts
- Update documentation and runbooks
- Architecture improvements
- Add or enhance tests
- Training or process changes

Examples:
- "Add connection pool usage dashboard and alert at 80% threshold"
- "Document connection pool sizing best practices"
- "Implement automated capacity testing in staging"
- "Add integration tests for high-concurrency scenarios"

### Checklist

Verify before recording conclusion:

- [ ] Root causes are clear and explain why they occurred
- [ ] Fixes have been verified to resolve the issue
- [ ] Prevention measures are defined to avoid recurrence
- [ ] Learnings are documented for team sharing
- [ ] Necessary documentation updates are identified
- [ ] Owners and deadlines assigned for follow-up actions

### Example Structure

\`\`\`json
{
  "rootCauses": [
    "Database connection pool size (50) insufficient for peak load (200 req/s)",
    "Connection timeout too short (1s), causing immediate retry failures"
  ],
  "fix": "Increased connection pool max to 200 and timeout to 5s. Deployed at 19:30 and confirmed error rate dropped to 0%.",
  "followUps": [
    "Create database connection count dashboard",
    "Add alert for connection pool exhaustion",
    "Run capacity tests regularly in staging environment",
    "Document connection pool configuration best practices"
  ]
}
\`\`\`

### Using the Tool

\`\`\`
conclusion_finalize caseId={{caseId}} \\
  rootCauses=["cause1", "cause2"] \\
  fix="implemented fix description" \\
  followUps=["action1", "action2"]
\`\`\`

### After Recording

- Case status automatically updates to \`closed\`
- Share with team members and spread learnings
- Track follow-up actions in your issue tracking system
- Schedule blameless postmortem if needed

### Additional Guidance

Use these tools for comprehensive follow-up planning:
- \`guidance_followups\` - Get domain-specific follow-up suggestions
- \`guidance_best_practices\` - Review RCA principles and anti-patterns`;

/**
 * Register rca_conclusion_guide prompt
 */
export async function registerConclusionGuidePrompt(server: McpServer) {
  server.registerPrompt(
    "rca_conclusion_guide",
    {
      description: "Guide for documenting RCA conclusions with root causes, fixes, and follow-ups",
      argsSchema: {
        caseId: z.string().describe("Target case ID"),
      },
    },
    async (args) => {
      const argsSchema = z.object({
        caseId: z.string(),
      });

      const parsed = argsSchema.parse(args);

      const content = render(CONCLUSION_GUIDE_TEMPLATE, {
        caseId: parsed.caseId,
      });

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: content,
            },
          },
        ],
      };
    },
  );
}
