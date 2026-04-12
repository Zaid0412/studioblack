type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LEVEL_PRIORITY) return envLevel as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getConfiguredLevel()];
}

/** Extract useful fields from an Error for structured output. */
function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      errorMessage: err.message,
      errorStack: err.stack,
      ...(err.cause ? { errorCause: String(err.cause) } : {}),
    };
  }
  return { errorMessage: String(err) };
}

/** Normalize a context object, extracting Error instances. */
function normalizeContext(
  context?: Record<string, unknown>
): Record<string, unknown> {
  if (!context) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      Object.assign(result, serializeError(value));
    } else {
      result[key] = value;
    }
  }
  return result;
}

function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...normalizeContext(context),
  };

  if (process.env.NODE_ENV === "production") {
    // Structured JSON for production log aggregators
    console.log(JSON.stringify(entry));
  } else {
    // Readable format for development
    const ctx = normalizeContext(context);
    const hasContext = Object.keys(ctx).length > 0;
    const consoleFn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : level === "debug"
            ? console.debug
            : console.log;

    if (hasContext) {
      consoleFn(`[${level.toUpperCase()}] ${message}`, ctx);
    } else {
      consoleFn(`[${level.toUpperCase()}] ${message}`);
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    log("error", message, context),
};
