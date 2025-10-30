import { z } from "zod";
import type { ToolDefinition } from "./types.js";

// Common enums
const phaseEnum = z.enum(["observation", "hypothesis", "testing", "conclusion"]);
const levelEnum = z.enum(["basic", "advanced"]).default("basic");

// guidance_best_practices
const bestPracticesInput = z.object({
  locale: z.string().optional(),
});

const bestPracticesOutput = z.object({
  systemPreamble: z.string(),
  heuristics: z.array(z.string()),
  antiPatterns: z.array(z.string()),
  citations: z.array(z.string()).optional(),
});

export type GuidanceBestPracticesInput = z.infer<typeof bestPracticesInput>;
export type GuidanceBestPracticesOutput = z.infer<typeof bestPracticesOutput>;

export const guidanceBestPracticesTool: ToolDefinition<
  GuidanceBestPracticesInput,
  GuidanceBestPracticesOutput
> = {
  name: "guidance_best_practices",
  description: "Return RCA principles, anti-patterns, and optional citations for the LLM.",
  inputSchema: bestPracticesInput,
  outputSchema: bestPracticesOutput,
  handler: async () => {
    return {
      systemPreamble:
        "You are an RCA assistant. Be evidence-driven, avoid bias, and propose reproducible, testable steps.",
      heuristics: [
        "Record observations as facts (timestamps, metrics, logs)",
        "Prefer diffs and timelines (before/after, change lists)",
        "Generate multiple hypotheses and rank by likelihood x impact",
        "Plan minimal, high-signal verification before costly steps",
      ],
      antiPatterns: [
        "Jumping to conclusions without sufficient evidence",
        "Blaming individuals instead of systems/process",
        "Skipping documentation of steps and decisions",
        "Ignoring negative/contradicting evidence",
      ],
      citations: [
        "Google SRE: Postmortem culture",
        "AWS Well-Architected: Operational Excellence",
        "Microsoft Azure: Incident Response",
      ],
    };
  },
};

// guidance_phase
const phaseInput = z.object({
  phase: phaseEnum,
  level: levelEnum.optional(),
});

const phaseOutput = z.object({
  steps: z.array(z.string()),
  checklists: z.array(z.string()),
  redFlags: z.array(z.string()),
  toolHints: z.array(z.string()),
});

export type GuidancePhaseInput = z.infer<typeof phaseInput>;
export type GuidancePhaseOutput = z.infer<typeof phaseOutput>;

export const guidancePhaseTool: ToolDefinition<GuidancePhaseInput, GuidancePhaseOutput> = {
  name: "guidance_phase",
  description: "Return phase-specific steps, checklists, red flags, and tool hints for the LLM.",
  inputSchema: phaseInput,
  outputSchema: phaseOutput,
  handler: async (input) => {
    const { phase } = input;
    switch (phase) {
      case "observation":
        return {
          steps: [
            "Capture factual observations with timestamps",
            "Collect metrics (CPU, memory, I/O, error rate)",
            "Assemble a timeline (deploys, config changes, incidents)",
          ],
          checklists: [
            "Include concrete numbers and units",
            "Reference relevant dashboards and logs",
            "Note environment (prod/staging) and versions",
          ],
          redFlags: [
            "Mixing speculation into observation records",
            "Missing time bounds around the incident",
          ],
          toolHints: ["observation_add", "case_update"],
        };
      case "hypothesis":
        return {
          steps: [
            "Derive multiple plausible causes from observations",
            "State each hypothesis to be testable and falsifiable",
            "Estimate likelihood and potential impact",
          ],
          checklists: [
            "Align with all observations (no contradictions)",
            "Reference recent diffs/changes when relevant",
          ],
          redFlags: [
            "Only one hypothesis considered",
            "Vague, untestable wording",
          ],
          toolHints: ["hypothesis_propose", "hypothesis_update", "bulk_delete_provisional"],
        };
      case "testing":
        return {
          steps: [
            "Define minimal, high-signal verification methods",
            "Set expected signals and thresholds",
            "Prioritize using RICE/ICE and run in safe environment first",
          ],
          checklists: [
            "Clear method, expected outcome, metric/threshold",
            "Document environment and preconditions",
          ],
          redFlags: [
            "Running costly tests without prioritization",
            "Missing rollback/containment plan",
          ],
          toolHints: ["test_plan", "test_plan_update", "test_prioritize"],
        };
      case "conclusion":
        return {
          steps: [
            "State root causes clearly and why they occurred",
            "Document the fix and verification evidence",
            "List follow-up actions for prevention and learning",
          ],
          checklists: [
            "Root cause explains all key observations",
            "Fix verified with metrics/logs",
            "Owners and deadlines for follow-ups",
          ],
          redFlags: [
            "Superficial cause (not root)",
            "No prevention plan or owners",
          ],
          toolHints: ["conclusion_finalize"],
        };
    }
  },
};

// guidance_prompt_scaffold
const scaffoldInput = z.object({
  task: z.enum(["hypothesis", "verification_plan", "next_step", "conclusion"]),
  strictness: z.number().min(0).max(1).optional(),
});

const scaffoldOutput = z.object({
  role: z.string(),
  format: z.string(),
  constraints: z.array(z.string()),
  examples: z.array(z.string()).optional(),
});

export type GuidancePromptScaffoldInput = z.infer<typeof scaffoldInput>;
export type GuidancePromptScaffoldOutput = z.infer<typeof scaffoldOutput>;

export const guidancePromptScaffoldTool: ToolDefinition<
  GuidancePromptScaffoldInput,
  GuidancePromptScaffoldOutput
> = {
  name: "guidance_prompt_scaffold",
  description: "Return role, output format, and constraints scaffolding for a given RCA task.",
  inputSchema: scaffoldInput,
  outputSchema: scaffoldOutput,
  handler: async (input) => {
    const commonConstraints = [
      "Be concise; avoid repetition",
      "Cite observations/hypotheses by id when available",
      "Prefer bullet lists and explicit metrics",
    ];

    switch (input.task) {
      case "hypothesis":
        return {
          role: "You are a senior RCA engineer generating testable hypotheses.",
          format:
            "Return an array of up to 3 items: [{text, rationale, confidence: 0..1}]",
          constraints: [...commonConstraints, "Each hypothesis must be falsifiable"],
          examples: [
            "Memory leak in service X release 2025-10-12 leading to OOM kills",
          ],
        };
      case "verification_plan":
        return {
          role: "You are planning minimal, high-signal verification steps.",
          format: "One plan: {method, expected, metric?, priority?}",
          constraints: [...commonConstraints, "Prefer safe, reversible steps first"],
        };
      case "next_step":
        return {
          role: "You suggest the next 1-3 concrete actions.",
          format: "List up to 3 bullets with action and rationale",
          constraints: [...commonConstraints, "Avoid generic suggestions"],
        };
      case "conclusion":
        return {
          role: "You summarize the RCA conclusion and follow-ups.",
          format: "{rootCauses:[], fix:string, followUps:[]}",
          constraints: [...commonConstraints, "Ensure causes explain observations"],
        };
    }
  },
};

// guidance_followups
const followupsInput = z.object({
  domain: z.array(z.string()).optional(),
});

const followupsOutput = z.object({
  actions: z.array(z.string()),
  ownersHint: z.string().optional(),
});

export type GuidanceFollowupsInput = z.infer<typeof followupsInput>;
export type GuidanceFollowupsOutput = z.infer<typeof followupsOutput>;

export const guidanceFollowupsTool: ToolDefinition<
  GuidanceFollowupsInput,
  GuidanceFollowupsOutput
> = {
  name: "guidance_followups",
  description: "Return post-conclusion follow-up actions.",
  inputSchema: followupsInput,
  outputSchema: followupsOutput,
  handler: async (input) => {
    const domain = (input.domain ?? []).map((d) => d.toLowerCase());
    const common = [
      "Add/adjust monitoring and alerts for early detection",
      "Document runbooks and update onboarding materials",
      "Schedule learning review (blameless postmortem)",
    ];
    const extras: string[] = [];
    if (domain.includes("database")) {
      extras.push("Capacity testing for connection pool and slow queries dashboard");
    }
    if (domain.includes("network")) {
      extras.push("Packet loss/latency SLOs and synthetic checks");
    }
    return {
      actions: [...common, ...extras],
      ownersHint: "Assign owners with deadlines; track in your issue system",
    };
  },
};

// guidance_prompts_catalog (LLM-facing prompt discovery)
const catalogInput = z.object({
  locale: z.string().optional(),
});

const catalogOutput = z.object({
  prompts: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      description: z.string(),
      whenToUse: z.array(z.string()).optional(),
      arguments: z
        .array(
          z.object({ name: z.string(), required: z.boolean().optional(), hint: z.string().optional() }),
        )
        .optional(),
    }),
  ),
});

export type GuidancePromptsCatalogInput = z.infer<typeof catalogInput>;
export type GuidancePromptsCatalogOutput = z.infer<typeof catalogOutput>;

export const guidancePromptsCatalogTool: ToolDefinition<
  GuidancePromptsCatalogInput,
  GuidancePromptsCatalogOutput
> = {
  name: "guidance_prompts_catalog",
  description: "Return a catalog of user-facing prompts summarized for the LLM.",
  inputSchema: catalogInput,
  outputSchema: catalogOutput,
  handler: async () => {
    return {
      prompts: [
        {
          name: "rca_start_investigation",
          title: "Start investigation",
          description: "Guide to create a new case and capture initial observations.",
          whenToUse: ["Right after incident", "No case yet"],
          arguments: [{ name: "incidentSummary", required: false, hint: "1-2 lines" }],
        },
        {
          name: "rca_next_step",
          title: "Next-step suggestion",
          description: "Concise next actions from current case state.",
          whenToUse: ["Unsure what to do", "Progress check"],
          arguments: [
            { name: "caseId", required: true },
            { name: "currentPhase", required: false },
          ],
        },
        {
          name: "rca_hypothesis_propose",
          title: "Hypothesis generation",
          description: "Propose up to 3 testable root-cause hypotheses.",
          whenToUse: ["Enough observations collected"],
          arguments: [
            { name: "caseId", required: true },
            { name: "observationSummary", required: false },
          ],
        },
      ],
    };
  },
};

// Use a widened ToolDefinition type so heterogeneous input/output schemas can coexist in one array
type AnyTool = ToolDefinition<any, any>;
export const GUIDANCE_TOOLS: AnyTool[] = [
  guidanceBestPracticesTool,
  guidancePhaseTool,
  guidancePromptScaffoldTool,
  guidanceFollowupsTool,
  guidancePromptsCatalogTool,
];
