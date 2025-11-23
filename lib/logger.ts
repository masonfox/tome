import pino, { LoggerOptions, Logger, DestinationStream } from 'pino';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

// AsyncLocalStorage to hold per-request context (correlation id and custom fields)
interface RequestContext {
  reqId: string;
  [key: string]: any;
}

const contextStore = new AsyncLocalStorage<RequestContext>();

// Environment configuration
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_PRETTY = process.env.LOG_PRETTY === 'true' && process.env.NODE_ENV !== 'production';
const LOG_DEST = process.env.LOG_DEST; // optional file path
const LOG_ENABLED = process.env.LOG_ENABLED !== 'false';

// Redaction list (basic sensitive fields)
const REDACT_PATHS = [
  'req.headers.authorization',
  'password',
  '*.password',
  'token',
  '*.token'
];

// Build pino options
const baseOptions: LoggerOptions = {
  level: LOG_LEVEL as any,
  enabled: LOG_ENABLED,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]'
  },
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  serializers: {
    err: (err: any) => {
      if (!err) return err;
      return {
        type: err.name,
        message: err.message,
        stack: err.stack,
      };
    },
  },
}

let destination: DestinationStream | undefined;
if (LOG_DEST) {
  destination = pino.destination({ dest: LOG_DEST, sync: false });
}

// Pretty transport only in development
let transport: any = undefined;
if (LOG_PRETTY) {
  transport = {
    target: 'pino-pretty',
    options: {
      ignore: 'pid,hostname',
      translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l',
      colorize: true,
    }
  };
}

// Singleton base logger
const baseLogger: Logger = pino({ ...baseOptions, transport }, destination);

export function getBaseLogger(): Logger {
  return baseLogger;
}

// Create a child logger with static context fields
export function createLogger(bindings?: Record<string, any>): Logger {
  return baseLogger.child(bindings || {});
}

// Retrieve a context-bound logger (includes reqId)
export function getLogger(): Logger {
  const store = contextStore.getStore();
  if (store) {
    return baseLogger.child({ reqId: store.reqId });
  }
  return baseLogger;
}

// Run a function within a request context (for API routes / middleware)
export function withRequestContext<T>(fn: (ctx: RequestContext) => Promise<T> | T, existingId?: string): Promise<T> | T {
  const ctx: RequestContext = { reqId: existingId || randomUUID() };
  return contextStore.run(ctx, () => fn(ctx));
}

// Utility for timing operations
export async function withTiming<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  const start = process.hrtime.bigint();
  const logger = getLogger();
  logger.debug({ op: label, phase: 'start' }, `${label} start`);
  try {
    const result = await fn();
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1_000_000;
    logger.info({ op: label, durationMs: ms }, `${label} complete`);
    return result;
  } catch (err: any) {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1_000_000;
    logger.error({ op: label, durationMs: ms, err }, `${label} failed`);
    throw err;
  }
}

export { contextStore };
