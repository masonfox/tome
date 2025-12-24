# ADR-009: Standardized API Response Format

**Status:** Accepted  
**Date:** 2025-12-23  
**Deciders:** Engineering Team  
**Context:** PR #150 Code Review  

## Context and Problem Statement

The Tome application currently has inconsistent API response formats across different endpoints:

```typescript
// Some endpoints return data directly
return NextResponse.json(seriesData);

// Others wrap in a success object
return NextResponse.json({ success: true, data: goalData });

// Error responses vary widely
return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
return NextResponse.json({ 
  success: false, 
  error: { code: "NOT_FOUND", message: "Book not found" }
}, { status: 404 });
```

This inconsistency makes it:
- Harder to write reusable frontend code
- Difficult to distinguish between successful and error responses programmatically
- Challenging to implement consistent error tracking and logging
- Confusing for API consumers

## Decision Drivers

* **Developer Experience**: Frontend developers need predictable response structures
* **Error Tracking**: Systematic error IDs for production debugging
* **Type Safety**: Strong TypeScript types for all responses
* **Backward Compatibility**: Minimize breaking changes to existing integrations
* **Testing**: Consistent patterns make tests easier to write and maintain

## Considered Options

### Option 1: Status Quo (No Standardization)
Keep the current mixed approach with no changes.

**Pros:**
- No migration effort required
- No breaking changes

**Cons:**
- Technical debt continues to accumulate
- Makes future API development inconsistent
- Harder to build shared utilities

### Option 2: Big Bang Migration
Immediately update all API routes to use the new format.

**Pros:**
- Immediate consistency across all endpoints
- Clean slate for future development

**Cons:**
- High risk of breaking existing functionality
- Large test migration effort (87 test files)
- Difficult to review in a single PR

### Option 3: Gradual Migration with Utility Functions (CHOSEN)
Provide standardized utilities and migrate routes incrementally.

**Pros:**
- Low risk - routes migrate one at a time
- Utilities can be battle-tested before wide adoption
- Tests can use helper functions to support both formats during transition
- Clear migration path documented for all developers

**Cons:**
- Temporary inconsistency during migration period
- Requires discipline to use new format for all new routes

## Decision Outcome

**Chosen option: Option 3 - Gradual Migration with Utility Functions**

We will:
1. Provide standardized response utilities (`lib/utils/api-responses.ts`)
2. Require all NEW API routes to use the standard format
3. Migrate existing routes incrementally as they're touched for other reasons
4. Provide test helpers to support both formats during transition

### Standard Response Format

#### Success Response Structure
```typescript
{
  success: true,
  data: T  // The actual response payload
}
```

#### Error Response Structure
```typescript
{
  success: false,
  error: {
    code: string,      // Machine-readable error code
    message: string,   // Human-readable error message
    errorId?: string   // UUID for tracking (5xx errors only)
  }
}
```

### Error Codes

Standardized error codes for common scenarios:

**Client Errors (4xx):**
- `INVALID_INPUT` - Malformed or invalid request data
- `MISSING_FIELD` - Required field is missing
- `INVALID_TYPE` - Field has wrong type
- `INVALID_ID` - ID parameter is invalid
- `NOT_FOUND` - Resource does not exist
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `ALREADY_EXISTS` - Resource already exists (409)

**Server Errors (5xx):**
- `INTERNAL_ERROR` - Unexpected server error
- `DATABASE_ERROR` - Database operation failed

### Implementation

#### Utility Functions

```typescript
// lib/utils/api-responses.ts

// Create standardized success response
export function createSuccessResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

// Create standardized error response
export function createErrorResponse(
  code: string,
  message: string,
  status = 500,
  errorId?: string
): NextResponse {
  const response = {
    success: false,
    error: { code, message, ...(errorId && { errorId }) }
  };
  return NextResponse.json(response, { status });
}

// Error handler wrapper
export function withErrorHandler<T extends Function>(
  handler: T,
  logger?: any
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const errorId = crypto.randomUUID();
      logger?.error({ error, errorId }, "Unhandled API error");
      return createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : "An unexpected error occurred",
        500,
        errorId
      );
    }
  }) as T;
}
```

#### Usage Example

**Before:**
```typescript
export async function GET() {
  try {
    const data = await service.getData();
    return NextResponse.json(data);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch data");
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
```

**After:**
```typescript
export async function GET() {
  try {
    const data = await service.getData();
    return createSuccessResponse(data);
  } catch (error) {
    const errorId = crypto.randomUUID();
    logger.error({ error, errorId }, "Failed to fetch data");
    return createErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      process.env.NODE_ENV === "development"
        ? (error as Error).message
        : "Failed to fetch data",
      500,
      errorId
    );
  }
}
```

**Even Better (with error handler):**
```typescript
export const GET = withErrorHandler(async () => {
  const data = await service.getData();
  return createSuccessResponse(data);
}, getLogger());
```

### Test Helpers

Test utilities support both old and new response formats:

```typescript
// __tests__/helpers/api-response-helpers.ts

// Extract data from either format
export function extractResponseData<T>(json: any): T {
  return json.success === true ? json.data : json;
}

// Extract error from either format
export function extractResponseError(json: any) {
  if (json.success === false) {
    return json.error; // New format
  }
  return { message: json.error }; // Old format
}
```

### Migration Strategy

1. **Phase 1: Foundation (Current PR)**
   - ✅ Create utility functions
   - ✅ Create test helpers
   - ✅ Document standards in this ADR
   - No route migrations yet (low risk)

2. **Phase 2: New Routes Only**
   - All new API routes MUST use standard format
   - Code reviews check for compliance
   - Estimated: Ongoing

3. **Phase 3: High-Traffic Routes**
   - Migrate frequently used endpoints
   - Update corresponding tests
   - Priority: `/api/books`, `/api/dashboard`, `/api/reading-goals`
   - Estimated: 2-3 PRs

4. **Phase 4: Remaining Routes**
   - Migrate remaining endpoints
   - Remove test helper compatibility layer
   - Remove old response patterns
   - Estimated: 3-5 PRs

### Frontend Consumption

TypeScript types ensure type-safe consumption:

```typescript
// Frontend code
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    errorId?: string;
  };
}

async function fetchSeries(): Promise<SeriesInfo[]> {
  const response = await fetch('/api/series');
  const json: ApiResponse<SeriesInfo[]> = await response.json();
  
  if (!json.success) {
    throw new Error(json.error?.message || 'Unknown error');
  }
  
  return json.data!;
}
```

### Error ID Tracking

Server errors (5xx) automatically generate UUIDs for tracking:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "errorId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Logs correlate with error IDs:

```json
{
  "level": "error",
  "time": "2025-12-23T10:30:45.123Z",
  "error": { "message": "Database connection failed", "stack": "..." },
  "errorId": "550e8400-e29b-41d4-a716-446655440000",
  "msg": "Failed to fetch series"
}
```

## Consequences

### Positive

* **Consistency**: Uniform response structure across all endpoints
* **Type Safety**: Strong TypeScript types for frontend consumption
* **Error Tracking**: Automatic error IDs for production debugging
* **Developer Experience**: Clear patterns for new API development
* **Testability**: Helper functions make tests support both formats
* **Low Risk**: Gradual migration minimizes breaking changes

### Negative

* **Temporary Inconsistency**: Mixed formats during migration period (6-12 months)
* **Migration Effort**: 50+ API routes need eventual migration
* **Test Updates**: Tests need updates as routes migrate
* **Documentation**: Must keep this ADR updated as migration progresses

### Neutral

* **Response Size**: Slightly larger payloads (+20 bytes avg) due to wrapper
* **Learning Curve**: New developers must learn the standard pattern

## Compliance

### Required for ALL New Routes

All API routes created after 2025-12-23 MUST:
- ✅ Use `createSuccessResponse()` for success cases
- ✅ Use `createErrorResponse()` with proper error codes
- ✅ Auto-generate error IDs for 5xx responses
- ✅ Log errors with correlation IDs
- ✅ Use TypeScript types from `api-responses.ts`

### Migration Checklist

When migrating an existing route:
- [ ] Update success responses to use `createSuccessResponse()`
- [ ] Update error responses to use `createErrorResponse()`
- [ ] Add error ID generation for 5xx errors
- [ ] Update corresponding tests to use `extractResponseData()`/`extractResponseError()`
- [ ] Verify all test cases pass
- [ ] Update any frontend code consuming the endpoint
- [ ] Document breaking changes in PR description

## Links

* [PR #150 Code Review](https://github.com/masonfox/tome/pull/150)
* Implementation: `lib/utils/api-responses.ts`
* Test Helpers: `__tests__/helpers/api-response-helpers.ts`
* Related: [ADR-005: Structured Logging](./ADR-005-STRUCTURED-LOGGING-PINO.md)
* Related: [ADR-007: Cache Invalidation](./ADR-007-LAYERED-CACHE-INVALIDATION-STRATEGY.md)
