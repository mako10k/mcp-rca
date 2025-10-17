import { inspect } from "node:util";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  component?: string;
  requestId?: string;
  meta?: unknown;
  timestamp?: string;
}

function normalizeMeta(meta: unknown): unknown {
  if (meta === undefined) {
    return undefined;
  }

  try {
    JSON.stringify(meta);
    return meta;
  } catch {
    return inspect(meta, { depth: 3, breakLength: 80 });
  }
}

export function log(entry: LogEntry): void {
  const payload: Record<string, unknown> = {
    level: entry.level,
    message: entry.message,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };

  if (entry.component) {
    payload.component = entry.component;
  }

  if (entry.requestId) {
    payload.requestId = entry.requestId;
  }

  const normalizedMeta = normalizeMeta(entry.meta);
  if (normalizedMeta !== undefined) {
    payload.meta = normalizedMeta;
  }

  console.error(JSON.stringify(payload));
}

export const logger = {
  debug(message: string, component?: string, meta?: unknown): void {
    log({ level: "debug", message, component, meta });
  },
  info(message: string, component?: string, meta?: unknown): void {
    log({ level: "info", message, component, meta });
  },
  warn(message: string, component?: string, meta?: unknown): void {
    log({ level: "warn", message, component, meta });
  },
  error(message: string, component?: string, meta?: unknown): void {
    log({ level: "error", message, component, meta });
  },
};
