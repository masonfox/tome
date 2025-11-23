import pinoHttp from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'http';
import { getBaseLogger, withRequestContext, getLogger } from './logger';

// pino-http middleware instance (Node req/res style). Not auto-used by Next route handlers
// but available for custom Node servers or edge cases.
export const httpLogger = pinoHttp({
  logger: getBaseLogger(),
  customLogLevel(res: ServerResponse, err?: Error) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req: any) {
      return {
        method: req.method,
        url: req.url,
        id: req.id,
      };
    },
    res(res: any) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
  wrapSerializers: true,
} as any);

// Helper for Next.js App Router route handlers (Request/Response abstraction)
// Wrap handler with request context and structured start/finish/error logs.
export async function withApiLogging<T>(request: Request, handler: () => Promise<T>): Promise<T> {
  return withRequestContext(async () => {
    const logger = getLogger();
    logger.info({ method: request.method, url: request.url }, 'API request start');
    try {
      const result = await handler();
      logger.info({ method: request.method, url: request.url }, 'API request complete');
      return result;
    } catch (err: any) {
      logger.error({ method: request.method, url: request.url, err }, 'API request error');
      throw err;
    }
  }, request.headers.get('x-request-id') || undefined);
}

// Lightweight function to log arbitrary response meta (status, timing) if needed.
export function logApiResponse(meta: { method: string; url: string; status?: number; durationMs?: number }) {
  const logger = getLogger();
  logger.info({ ...meta }, 'API response');
}
