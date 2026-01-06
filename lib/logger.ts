import type { LoggerOptions, Logger } from 'pino';

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
  base: {
    pid: undefined,
    hostname: undefined,
  },
};

// Check if we're in a server environment (Node.js/Bun) vs browser
const isServer = typeof process !== 'undefined' && process.versions?.node;

// Note: pino-pretty transport removed due to Turbopack bundling issues in Next.js 16
// Turbopack performs static analysis and tries to bundle 'pino-pretty' even when the
// condition is false, causing EISDIR errors during instrumentation phase.
// 
// Logs now output as structured JSON (pino's default), which is production-appropriate.
// For pretty logs in local development, pipe output through pino-pretty externally:
//   bun run dev | bunx pino-pretty
//
// Multi-stream logging (stdout + file) is preserved and unaffected by this change.

// Lazy initialization of logger to avoid loading pino during build phase
let baseLogger: Logger | null = null;

function initializeLogger(): Logger {
  if (baseLogger) return baseLogger;
  
  // Dynamic import of pino to avoid bundling issues during instrumentation
  const pino = require('pino');
  
  // Configure multi-stream to write to both stdout and file (server-side only)
  // This ensures logs are visible in container logs (Portainer) AND persisted to file
  if (isServer && LOG_DEST) {
    // Server-side with file destination: use multi-stream for both stdout and file
    const streams: any[] = [
      { stream: process.stdout },
      { stream: pino.destination({ dest: LOG_DEST, sync: false }) }
    ];
    baseLogger = pino({ ...baseOptions }, pino.multistream(streams));
  } else if (isServer) {
    // Server-side without file destination: default to stdout
    baseLogger = pino({ ...baseOptions });
  } else {
    // Client-side: create a minimal logger (browser console fallback)
    baseLogger = pino({ ...baseOptions, browser: { asObject: true } });
  }
  
  return baseLogger!;
}

export function getBaseLogger(): Logger { 
  return initializeLogger();
}

export function createLogger(bindings?: Record<string, any>): Logger { 
  return initializeLogger().child(bindings || {}); 
}

export function getLogger(): Logger {
  const logger = initializeLogger();
  const store = contextStore.getStore();
  if (store) return logger.child({ reqId: store.reqId });
  return logger;
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
