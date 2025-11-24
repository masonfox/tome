# ADR-005: Structured Logging with Pino

## Status
Accepted

## Context
The application currently relies on ad-hoc `console.*` logging across API routes, database initialization, services, and operational scripts. This approach lacks consistency (levels, correlation IDs), structure (JSON fields), and redaction of sensitive data. As the project expands (database migrations, Calibre sync, performance tracking), observability needs increase. We need low-overhead structured logs that can be parsed, filtered, and shipped to future aggregation systems (Loki/ELK) without refactors.

## Decision
Adopt [Pino](https://getpino.io) as the primary runtime logger for server-side code and operational scripts, including `pino-http` for HTTP request logging. Implement a core logger module providing:
- Singleton base logger with environment-driven configuration.
- AsyncLocalStorage-backed request context (correlation `reqId`).
- Child loggers for services/repositories with static bindings (e.g. `module: 'BookService'`).
- Timing helper (`withTiming`) for performance spans.
- Redaction of sensitive fields (`authorization`, `password`, `token`).
- Pretty printing only in non-production environments.

## Details
### Environment Variables
- `LOG_LEVEL` (default `info`) – levels: trace|debug|info|warn|error|fatal|silent
- `LOG_PRETTY` (default enabled only in dev) – enables `pino-pretty` transport.
- `LOG_DEST` (optional) – file path destination; defaults to stdout.
- `LOG_ENABLED` (default true) – allow disabling entirely (e.g. certain benchmarks).

### Correlation / Context
An `AsyncLocalStorage` store holds `{ reqId }`. Middleware or handler wrappers generate a UUIDv4 for each incoming request (honoring `x-request-id` if provided). `getLogger()` returns a child logger with `reqId` automatically bound.

### HTTP Logging
Use `pino-http` with custom serializers for request and response objects. Log level determined by status code and presence of errors.

### Redaction
Configured via pino `redact` option to replace sensitive values with `[REDACTED]`.

### Error Serialization
Errors logged with `err` serializer producing `{ type, message, stack }` for easier ingestion.

### Performance Timing
`withTiming(label, fn)` logs start (debug), success (info with `durationMs`), or failure (error with `durationMs`).

### Test Strategy
Tests run with `NODE_ENV=test` and may set `LOG_LEVEL=silent` to suppress output. A future enhancement could expose an in-memory destination for assertions.

### Migration Strategy (Phased)
1. Introduce logger modules and env variables (keep existing `console.*`).
2. Replace critical `console.error` statements (DB, migrations, API error paths) with logger calls.
3. Replace remaining `console.log/warn` for consistency.
4. Optional: ESLint rule to disallow direct `console.*` usage outside tests.

### Future Enhancements (Deferred)
- File rotation / multi-stream outputs.
- Structured metrics emission (log -> metrics bridge).
- Log sampling for debug level in production.
- In-memory log collector for integration tests.

## Alternatives Considered
- Winston: Higher abstraction but slower performance; more configuration overhead.
- Consola / Roarr: Less widely adopted or feature-complete vs pino.
- OpenTelemetry logs: Heavy for current scope; pino integrates later via exporters.

## Consequences
- Introduces dependency and minimal runtime overhead (~microseconds per call).
- JSON logs facilitate future centralized ingestion.
- Slight increase in code verbosity (structured calls vs `console.log`).
- Developers need to adopt new conventions (levels, context binding) documented.

## Implementation Progress
(Keep updated during rollout)
- [x] Dependencies added (pino, pino-http, pino-pretty).
- [x] Env variables documented in `.env.example`.
- [x] Core logger module (`lib/logger.ts`).
- [x] HTTP logging helper (`lib/logger-http.ts`).
- [x] Middleware context integration.
- [x] Replace critical error logs in db/service layers.
- [ ] Replace remaining console usage (in progress partial).
- [x] Test silent mode confirmation.
- [ ] Add logging usage guide.

## Usage Examples
```ts
import { getLogger, withTiming } from '@/lib/logger';

async function syncLibrary() {
  return withTiming('calibre.sync', async () => {
    const logger = getLogger();
    logger.info({ phase: 'start' }, 'Starting Calibre sync');
    // ... work ...
    logger.debug({ booksProcessed: 42 });
  });
}

try {
  await syncLibrary();
} catch (err) {
  getLogger().error({ err }, 'Calibre sync failed');
}
```

```ts
// In an API route
import { withHttpLogging } from '@/lib/logger-http';
export async function GET() {
  return withHttpLogging(async () => {
    const logger = getLogger();
    logger.info('Fetching stats');
    // ...
    return Response.json({ ok: true });
  });
}
```

## Decision Date
2025-11-23
