# ADR-010: Hybrid API Client Architecture

**Status:** Accepted  
**Date:** 2024-12-29  
**Deciders:** Development Team  
**Tags:** architecture, api, typescript, dx

## Context

The application currently makes raw `fetch()` calls directly in React hooks and components throughout the codebase. With 38 API endpoints across 12 domain areas (books, reading-goals, streak, series, tags, journal, stats, etc.), this approach has several issues:

### Problems with Current Approach

1. **No Type Safety**
   - Request/response shapes are not typed
   - Easy to make typos in URLs (`/api/books/${bookId}/progres` instead of `progress`)
   - Runtime errors instead of compile-time errors

2. **Repetitive Boilerplate**
   ```typescript
   const response = await fetch(`/api/books/${bookId}/status`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ status: "reading" }),
   });
   
   if (!response.ok) {
     throw new Error("Failed to update status");
   }
   
   return response.json();
   ```
   This pattern is repeated 100+ times across the codebase.

3. **Inconsistent Error Handling**
   - Some code checks `response.ok`, some doesn't
   - Error messages are generic and unhelpful
   - No standardized way to handle timeouts, network errors, or 4xx/5xx responses

4. **Hard to Test**
   - Must mock global `fetch` in every test
   - Complex setup for different response scenarios
   - No easy way to test error paths

5. **Poor Developer Experience**
   - No autocomplete for endpoints
   - Must remember exact URLs and request shapes
   - Easy to forget required fields

6. **No Central Configuration**
   - Can't easily add auth headers globally
   - Can't add retry logic or request interceptors
   - No request/response transformation layer

## Decision

We will implement a **Hybrid API Client Architecture** that balances type safety and maintainability with simplicity and pragmatism.

### Architecture Overview

```
┌─────────────────────┐
│   React Hooks       │  useBookStatus, useBookProgress, etc.
│   (UI Logic)        │  - State management
└──────────┬──────────┘  - User interactions
           │
           │ imports
           ▼
┌─────────────────────┐
│   Domain APIs       │  bookApi, goalsApi, streakApi, etc.
│   (Helper Objects)  │  - Typed method wrappers
└──────────┬──────────┘  - Domain-specific logic
           │
           │ uses
           ▼
┌─────────────────────┐
│   BaseApiClient     │  Core HTTP client
│   (Foundation)      │  - Error handling
└──────────┬──────────┘  - Type safety
           │           - Request/response transformation
           │ makes
           ▼
┌─────────────────────┐
│   Fetch API         │  Native browser fetch
│   (HTTP Layer)      │  - Actual network calls
└─────────────────────┘
```

### Three-Layer Approach

#### Layer 1: BaseApiClient (Foundation)
A single base class that handles:
- HTTP methods (GET, POST, PATCH, DELETE)
- Error handling and custom error types
- Timeout management
- JSON serialization/deserialization
- Response validation

#### Layer 2: Domain API Objects (Lightweight Helpers)
Domain-specific objects (NOT classes) with typed methods:
- `bookApi` - Book-related endpoints
- `goalsApi` - Reading goals endpoints
- `streakApi` - Streak tracking endpoints
- `seriesApi` - Series endpoints
- etc.

These are simple object literals with functions, not heavyweight classes.

#### Layer 3: React Hooks (Consumers)
Hooks call domain API methods instead of raw fetch:
```typescript
// Before
await fetch(`/api/books/${bookId}/status`, { ... });

// After
await bookApi.updateStatus(bookId, { status: "reading" });
```

### Why Hybrid (Not Full Domain Classes)?

We chose the hybrid approach over full domain classes because:

1. **Right-Sized for Our App**
   - 38 endpoints across 12 domains (medium-sized app)
   - Full classes would be overkill (that's for 100+ endpoint apps like Stripe)
   - Simple objects provide 90% of benefits with 50% of complexity

2. **Lightweight & Pragmatic**
   - No need to instantiate clients
   - No complex dependency injection
   - Easy to import and use: `import { bookApi } from '@/lib/api'`

3. **Excellent Developer Experience**
   - Full autocomplete: `bookApi.` shows all methods
   - Type safety for requests and responses
   - Easy to mock in tests

4. **Scalable**
   - Can start with just `bookApi`
   - Add other domains incrementally
   - Can refactor to full classes later if needed

### Why Not Just BaseApiClient?

A flat structure (just BaseApiClient) would be too bare-bones because:
- No autocomplete (must remember exact URLs)
- No domain organization (all 38 endpoints mixed together)
- No type safety for specific endpoints
- Hard to discover related endpoints

## Implementation Plan

### Phase 1: Foundation (This PR)
1. Create `BaseApiClient` with error handling
2. Define TypeScript types for book API
3. Create `bookApi` domain helper
4. Refactor `useBookStatus` to use `bookApi`
5. Add comprehensive tests

### Phase 2: Incremental Migration (Future PRs)
Gradually migrate other domains:
- `progressApi` (progress logging endpoints)
- `goalsApi` (reading goals endpoints)
- `streakApi` (streak tracking endpoints)
- `seriesApi` (series endpoints)
- `tagApi` (tag management endpoints)
- etc.

Each domain can be migrated independently without breaking existing code.

## Consequences

### Positive

1. **Type Safety** ✅
   - Compile-time errors for typos and wrong types
   - Full IntelliSense support in IDEs
   - Self-documenting API contracts

2. **Better DX** ✅
   - Autocomplete shows all available methods
   - Clear method signatures with JSDoc
   - Easy to discover related endpoints

3. **Consistency** ✅
   - Standardized error handling
   - Uniform request/response patterns
   - Single place to add middleware (auth, logging, etc.)

4. **Easier Testing** ✅
   - Mock domain objects instead of global fetch
   - Type-safe test mocks
   - Clear test boundaries

5. **Maintainability** ✅
   - Changes to error handling apply everywhere
   - Easy to add new endpoints
   - Clear separation of concerns

6. **Performance** ✅
   - No overhead (just thin wrappers)
   - Tree-shaking friendly
   - Same bundle size as raw fetch

### Negative

1. **Additional Abstraction** ⚠️
   - One more layer to understand
   - Slightly more files to maintain
   - **Mitigation:** Keep domain objects simple (just functions)

2. **Type Sync** ⚠️
   - Must keep types in sync with backend
   - **Mitigation:** Types live next to usage, easy to update together

3. **Learning Curve** ⚠️
   - Team must learn new pattern
   - **Mitigation:** Comprehensive documentation and examples

4. **Migration Effort** ⚠️
   - 100+ fetch calls to migrate
   - **Mitigation:** Incremental migration, old code still works

### Neutral

- **Bundle Size:** Negligible increase (~1-2KB after compression)
- **Runtime Performance:** No measurable impact
- **Build Time:** No impact

## Alternatives Considered

### Alternative 1: Keep Raw Fetch Everywhere
**Decision:** ❌ Rejected

**Pros:**
- No changes needed
- Familiar to all developers
- Zero abstraction

**Cons:**
- All the problems listed in Context section
- Technical debt grows with each new endpoint
- Poor developer experience

### Alternative 2: Full Domain Classes (like Stripe SDK)
**Decision:** ❌ Rejected for now (too heavyweight)

```typescript
const bookApiClient = new BookApiClient();
const goalsApiClient = new GoalsApiClient();

await bookApiClient.updateStatus(bookId, { status: "reading" });
```

**Pros:**
- Maximum organization
- Can have per-client configuration
- Industry standard for large APIs (Stripe, AWS, etc.)

**Cons:**
- Overkill for 38 endpoints
- More boilerplate (class definitions)
- Must instantiate clients
- Heavier abstraction

**When this makes sense:** 100+ endpoints, very large team, complex domain logic

### Alternative 3: tRPC or Similar
**Decision:** ❌ Rejected (requires backend changes)

**Pros:**
- End-to-end type safety
- Automatic type generation
- Excellent DX

**Cons:**
- Requires rewriting entire backend
- Vendor lock-in
- Learning curve for team
- Not practical for incremental adoption

## Examples

### Before (Current Code)
```typescript
// In useBookStatus.ts
async function ensureReadingStatus(bookId: string, currentStatus?: string): Promise<void> {
  if (currentStatus === "reading") return;

  const response = await fetch(`/api/books/${bookId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "reading" }),
  });

  if (!response.ok) {
    throw new Error("Failed to transition to reading status");
  }
}
```

### After (With API Client)
```typescript
// In useBookStatus.ts
import { bookApi } from "@/lib/api";

async function ensureReadingStatus(bookId: string, currentStatus?: string): Promise<void> {
  if (currentStatus === "reading") return;

  try {
    await bookApi.updateStatus(bookId, { status: "reading" });
  } catch (error) {
    if (error instanceof ApiError) {
      getLogger().error({ 
        bookId, 
        statusCode: error.statusCode, 
        details: error.details 
      }, "Failed to transition to reading status");
    }
    throw new Error("Failed to transition to reading status");
  }
}
```

**Benefits of new approach:**
- ✅ No repetitive fetch boilerplate
- ✅ Type-safe request/response
- ✅ Structured error handling
- ✅ Easy to mock in tests

## Testing Strategy

### Unit Tests for BaseApiClient
```typescript
describe("BaseApiClient", () => {
  test("handles successful responses", async () => {
    // Test JSON parsing, status codes, etc.
  });

  test("handles error responses", async () => {
    // Test 4xx/5xx error handling
  });

  test("handles timeouts", async () => {
    // Test timeout behavior
  });
});
```

### Integration Tests for Domain APIs
```typescript
describe("bookApi", () => {
  test("updateStatus calls correct endpoint", async () => {
    // Verify URL, method, payload
  });

  test("createProgress returns typed response", async () => {
    // Verify response shape matches types
  });
});
```

### Hook Tests (Existing)
```typescript
// Existing hook tests continue to work
// Just mock bookApi instead of global fetch
vi.mock("@/lib/api/book-api", () => ({
  bookApi: {
    updateStatus: vi.fn().mockResolvedValue({ success: true }),
  },
}));
```

## Migration Path

### Step 1: Create Foundation (Week 1)
- Implement `BaseApiClient`
- Define types for book API
- Create `bookApi` domain helper
- Add comprehensive tests

### Step 2: Migrate One Hook (Week 1)
- Refactor `useBookStatus` to use `bookApi`
- Update tests
- Verify no regressions
- Document learnings

### Step 3: Evaluate (Week 2)
- Team reviews new pattern
- Gather feedback
- Adjust if needed
- Decide on rollout plan

### Step 4: Incremental Migration (Weeks 3-8)
- Migrate one domain per week:
  - Week 3: `progressApi`
  - Week 4: `goalsApi`
  - Week 5: `streakApi`
  - Week 6: `seriesApi`
  - Week 7: `tagApi`
  - Week 8: Remaining domains

### Step 5: Cleanup (Week 9)
- Remove unused fetch calls
- Update documentation
- Create migration guide for future endpoints

## Rollback Plan

If the pattern doesn't work well:

1. **Easy Rollback:** Keep old fetch-based code alongside new API client
2. **No Breaking Changes:** Both patterns can coexist
3. **Incremental Revert:** Can revert one domain at a time
4. **Low Risk:** Only affects new code, existing code unchanged

## References

- [Stripe API Client Design](https://github.com/stripe/stripe-node) - Full domain classes
- [Supabase Client](https://github.com/supabase/supabase-js) - Hybrid approach
- [Octokit (GitHub API)](https://github.com/octokit/octokit.js) - Domain objects
- [ADR-009: Standardized API Responses](./ADR-009-STANDARDIZED-API-RESPONSES.md) - Related decision

## Success Metrics

We'll consider this successful if:

1. **Type Safety:** 0 runtime errors due to API typos (measured via error logs)
2. **Developer Velocity:** 20% faster to add new endpoints (measured via PR review time)
3. **Test Coverage:** Easier to mock in tests (measured via test complexity)
4. **Team Satisfaction:** Positive feedback from developers (measured via retro)
5. **No Performance Regression:** API calls remain fast (measured via monitoring)

## Notes

- This ADR applies to **client-side API calls only** (React hooks, components)
- Server-side API routes are unaffected
- Backend services (BookService, ProgressService, etc.) are unaffected
- This is about the HTTP layer, not business logic

---

**Last Updated:** 2024-12-29  
**Next Review:** After Phase 1 implementation (estimated 2025-01-15)
