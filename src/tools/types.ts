export interface ToolContext {
  requestId: string;
  now: () => Date;
  logger?: {
    info: (message: string, meta?: unknown) => void;
    error: (message: string, meta?: unknown) => void;
  };
}

export interface ToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  handler: (input: Input, context: ToolContext) => Promise<Output>;
}
