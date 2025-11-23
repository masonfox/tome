import pino, { LoggerOptions, Logger, DestinationStream } from 'pino';

// Edge-compatible UUID generator
function generateReqId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Minimal request context store (no AsyncLocalStorage in Edge build phase)
interface RequestContext { reqId: string; [key: string]: any; }
const contextStore: { getStore: () => RequestContext | null; run: (ctx: RequestContext, fn: () => any) => any } = {
  getStore: () => null,
  run: (_ctx, fn) => fn()
};

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
};

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

export function getBaseLogger(): Logger { return baseLogger; }
export function createLogger(bindings?: Record<string, any>): Logger { return baseLogger.child(bindings || {}); }

export function getLogger(): Logger {
  const store = contextStore.getStore();
  if (store) return baseLogger.child({ reqId: store.reqId });
  return baseLogger;
}

export function withRequestContext<T>(fn: (ctx: RequestContext) => Promise<T> | T, existingId?: string): Promise<T> | T {
  const ctx: RequestContext = { reqId: existingId || generateReqId() };
  return contextStore.run(ctx, () => fn(ctx));
}

export async function withTiming<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const logger = getLogger();
  logger.debug({ op: label, phase: 'start' }, `${label} start`);
  try {
    const result = await fn();
    const end = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const ms = end - start;
    logger.info({ op: label, durationMs: ms }, `${label} complete`);
    return result;
  } catch (err: any) {
    const end = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const ms = end - start;
    logger.error({ op: label, durationMs: ms, err }, `${label} failed`);
    throw err;
  }
}

export { contextStore };
