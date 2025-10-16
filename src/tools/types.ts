export interface ToolContext {
  requestId: string;
  now: () => Date;
  logger?: {
    info: (message: string, meta?: unknown) => void;
    error: (message: string, meta?: unknown) => void;
  };
}

import type { z } from "zod";

export interface ToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  outputSchema: z.ZodType<Output>;
  handler: (input: Input, context: ToolContext) => Promise<Output>;
}
