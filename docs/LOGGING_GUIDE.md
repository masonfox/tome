# Logging Guide

This guide explains how to use the Pino-based structured logging system throughout the project.

## Goals
- Consistent, structured JSON logs for server-side code (API routes, services, repositories, scripts).
- Correlation of log events per request via `reqId`.
- Safe logging with redaction of sensitive fields.
- Lightweight helpers for timing and API request lifecycle.

## Core Modules
- `lib/logger.ts`: Base logger, context management, timing helper.
- `lib/logger-http.ts`: HTTP logging utilities (`httpLogger`, `withApiLogging`).

## Environment Variables
| Name | Default | Description |
|------|---------|-------------|
| `LOG_LEVEL` | `info` | Pino level (`trace|debug|info|warn|error|fatal|silent`). |
| `LOG_PRETTY` | `true` in dev | Enables `pino-pretty` transport (ignored in production). |
| `LOG_DEST` | unset | File path destination; stdout if unset. |
| `LOG_ENABLED` | `true` | Disable all logging if set to `false`. |

## Selecting a Logger
Use one of the following patterns depending on context:

```ts
import { getLogger, createLogger } from '@/lib/logger';

// Request-bound context (includes reqId if inside withRequestContext)
const logger = getLogger();

// Static bindings for a module/service
const bookLogger = createLogger({ module: 'BookService' });
bookLogger.info({ bookId }, 'Book fetched');
```

Avoid storing a logger from `getLogger()` outside of a request lifecycle; it will not update if called outside context.

## Request Context
Wrap work that should have a `reqId` correlation ID:

```ts
import { withRequestContext, getLogger } from '@/lib/logger';

export async function handler(req: Request) {
  return withRequestContext(async () => {
    const logger = getLogger();
    logger.info({ path: new URL(req.url).pathname }, 'Handling request');
    // ...
  }, req.headers.get('x-request-id') || undefined);
}
```
Middleware already applies this for App Router requests.

## API Route Logging
For API routes prefer structured error logging:
```ts
try {
  // work
} catch (err) {
  const { getLogger } = require('@/lib/logger');
  getLogger().error({ err }, 'Failed to process request');
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
```

Optionally wrap a route with `withApiLogging(request, handler)` if start/complete/error logs are desired:
```ts
import { withApiLogging } from '@/lib/logger-http';

export async function GET(request: Request) {
  return withApiLogging(request, async () => {
    // handler work
    return Response.json({ ok: true });
  });
}
```

## Log Structure Conventions
- Object first, then message: `logger.info({ bookId }, 'Book fetched');`
- Use concise messages (action + context).
- Include stable identifiers: `bookId`, `sessionId`, `userId`.
- Use semantic levels:
  - `debug`: detailed internal state, start/end markers.
  - `info`: successful high-level operations (created session, sync complete).
  - `warn`: recoverable or unexpected but non-failing conditions (missing optional data).
  - `error`: operation failed.
  - `fatal`: unrecoverable process-level failure (rare; not yet used).

## Error Logging
Always log errors with the `err` field for proper serialization:
```ts
catch (err) {
  logger.error({ err, bookId }, 'Book fetch failed');
}
```
Pino's configured `err` serializer outputs `{ type, message, stack }`.

## Timing Operations
Use `withTiming(label, fn)` for performance spans:
```ts
import { withTiming, getLogger } from '@/lib/logger';

await withTiming('calibre.sync', async () => {
  const logger = getLogger();
  logger.info('Starting Calibre sync');
  // work
});
```
Generates:
- `debug` start log `{ op, phase: 'start' }`
- `info` completion log `{ op, durationMs }`
- `error` failure log `{ op, durationMs, err }`

## Child Loggers
Use `createLogger({ module: 'ProgressService' })` for components where adding static bindings improves filterability.
Do not add dynamic values as static bindings.

## Redaction
Sensitive paths are redacted automatically (`authorization`, `password`, `token`). Do not log secrets explicitly. Prefer referencing metadata or IDs.

## Disabling / Adjusting Logging
- Set `LOG_LEVEL=silent` for performance tests or noisy debugging scenarios.
- Set `LOG_ENABLED=false` to disable all logging (rare; may hide important diagnostics).

## Testing Guidance
Tests run with `LOG_LEVEL=silent` to reduce noise. If asserting log output in future, introduce an in-memory destination (future enhancement).

## Migration Pattern (Examples)
Before:
```ts
console.error('Failed to sync', error);
```
After:
```ts
getLogger().error({ err: error }, 'Sync failed');
```

Before:
```ts
console.log('Cover request:', { bookId });
```
After:
```ts
getLogger().info({ bookId }, 'Cover request');
```

## Common Pitfalls
- Using message first then object: `logger.info('msg', { obj })` (incorrect) – results in treating object as extra args without structure.
- Reusing a context logger outside `withRequestContext` scope (loses `reqId`). Re-acquire via `getLogger()` inside the scoped function.
- Logging huge objects; instead log IDs or summary counts.

## Future Enhancements
See ADR for deferred items (sampling, rotation, metrics bridge).

## Quick Reference
| Task | Approach |
|------|----------|
| General logging | `getLogger().info({ id }, 'Action')` |
| Error logging | `getLogger().error({ err, id }, 'Failure')` |
| Timing | `withTiming('operation', fn)` |
| Request context | `withRequestContext(fn, existingReqId?)` |
| Child logger | `createLogger({ module: 'X' })` |
| API route lifecycle | `withApiLogging(request, handler)` |

---
Adopt these conventions to maintain clarity and observability as the system grows.
