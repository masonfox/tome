# Research: Support Non-Calibre Books

**Branch**: `003-non-calibre-books` | **Date**: 2026-02-05

## Phase 0: Architecture Research & Technical Decisions

This document resolves all "NEEDS CLARIFICATION" items from the implementation plan and establishes architectural patterns for multi-source book tracking.

---

## Research Areas

### 1. Provider Interface Design

**Question**: How should the `IMetadataProvider` interface be structured to support diverse provider capabilities?

**Decision**: Static TypeScript interface with boolean capability flags

**Rationale**:
- **Extensibility**: New providers can declare capabilities without modifying core code
- **Type safety**: TypeScript enforces interface compliance at compile time
- **Runtime validation**: Registry checks capabilities before dispatching operations
- **Clear contracts**: Explicit boolean flags (hasSearch, hasMetadataFetch, hasSync, requiresAuth)

**Interface Structure**:
```typescript
export interface IMetadataProvider {
  // Identity
  id: string;                    // 'calibre', 'manual', 'hardcover', 'openlibrary'
  name: string;                  // Display name
  
  // Capabilities (checked at runtime)
  capabilities: {
    hasSearch: boolean;          // Can search for books by query
    hasMetadataFetch: boolean;   // Can fetch metadata by external ID
    hasSync: boolean;            // Can sync entire library
    requiresAuth: boolean;       // Requires API key/credentials
  };
  
  // Operations (optional - checked via capabilities)
  search?(query: string): Promise<BookMetadata[]>;
  fetchMetadata?(externalId: string): Promise<BookMetadata>;
  sync?(): Promise<SyncResult>;
  
  // Health monitoring
  healthCheck(): Promise<ProviderHealth>;
}

export type ProviderHealth = 'healthy' | 'unavailable';
```

**Alternatives Considered**:
- ❌ **Abstract base class with inheritance**: Too rigid, forces providers to inherit methods they don't use
- ❌ **Plugin system with dynamic loading**: Over-engineered for 4 built-in providers
- ❌ **Separate interfaces per capability**: Verbose, harder to reason about provider capabilities at a glance

**Implementation Notes**:
- Registry validates capabilities match implemented methods at startup
- Missing optional methods throw descriptive errors if called despite capability flags
- Health checks run independently per provider (circuit breaker pattern)

---

### 2. Provider Configuration Storage

**Question**: Where and how should provider configurations be stored?

**Decision**: SQLite `provider_configs` table with JSON fields for settings/credentials

**Rationale**:
- **Consistency**: Uses existing SQLite infrastructure (no new storage layer)
- **Self-contained**: Aligns with constitution's zero external dependencies principle
- **Flexibility**: JSON fields allow provider-specific settings without schema changes
- **Simplicity**: Plaintext credentials acceptable for single-user local deployments

**Schema Design**:
```sql
CREATE TABLE provider_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT UNIQUE NOT NULL,     -- 'hardcover', 'openlibrary'
  enabled BOOLEAN NOT NULL DEFAULT 1,   -- Runtime enable/disable
  config JSON,                          -- { timeout: 5000, apiEndpoint: '...' }
  credentials JSON,                     -- { apiKey: '...' } (plaintext)
  last_health_check TIMESTAMP,
  health_status TEXT,                   -- 'healthy' | 'unavailable'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Alternatives Considered**:
- ❌ **Environment variables only**: No runtime enable/disable, requires restart for config changes
- ❌ **Encrypted credentials**: Over-engineered for single-user deployments (see FR-014c)
- ❌ **Separate tables per provider**: Schema complexity, harder to manage uniformly

**Migration Strategy**:
1. Create `provider_configs` table via Drizzle migration
2. Seed with default configs for built-in providers
3. Calibre provider config only if `CALIBRE_DB_PATH` env var set

---

### 3. Federated Search Architecture

**Question**: How should federated search coordinate multiple providers efficiently?

**Decision**: Parallel promise-based dispatch with provider-level timeouts and result merging

**Rationale**:
- **Performance**: Parallel execution prevents slow providers from blocking fast ones
- **Resilience**: Provider-level timeouts (5s) and error handling isolate failures
- **User experience**: Partial results better than all-or-nothing (graceful degradation)
- **Simplicity**: Promise.allSettled() handles race conditions without complex orchestration

**Flow Architecture**:
```
User Query
    ↓
SearchService.federatedSearch(query)
    ↓
Promise.allSettled([
  hardcoverProvider.search(query) → 5s timeout → [results] or error,
  openlibraryProvider.search(query) → 5s timeout → [results] or error
])
    ↓
Filter fulfilled promises → Merge results → Sort by priority
    ↓
Return { results: BookMetadata[], errors: ProviderError[] }
```

**Caching Strategy** (FR-011d):
- **Key**: `${query}:${enabledProviderIds.sort().join(',')}`
- **TTL**: 5 minutes
- **Invalidation**: Provider enable/disable triggers cache clear
- **Storage**: In-memory Map (singleton service instance)

**Priority Sorting** (FR-011g):
- Hardcoded order: Hardcover → OpenLibrary
- Within provider: Preserve API's internal ranking
- No cross-provider deduplication (FR-015b)

**Alternatives Considered**:
- ❌ **Sequential search with early exit**: Slower, defeats parallelism purpose
- ❌ **Redis cache**: External dependency violates constitution
- ❌ **Persistent cache in SQLite**: Stale data issues, cache invalidation complexity

---

### 4. Circuit Breaker Pattern

**Question**: How should the circuit breaker pattern prevent cascading failures?

**Decision**: Per-provider state machine with automatic disable/re-enable

**Rationale**:
- **Isolation**: Provider failures don't cascade to other providers or core features
- **Automatic recovery**: Cooldown period (60s) allows self-healing without manual intervention
- **Observability**: State changes logged for debugging (FR-021a)
- **Simplicity**: Three states (CLOSED, OPEN, HALF_OPEN) with clear transitions

**State Machine**:
```
CLOSED (healthy)
    ↓ (5 consecutive failures)
OPEN (disabled)
    ↓ (60s cooldown)
HALF_OPEN (testing)
    ↓ (1 success)          ↓ (1 failure)
CLOSED                     OPEN
```

**Implementation**:
```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN');
      }
    }
    
    try {
      const result = await operation();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = new Date();
      
      if (this.failureCount >= 5) {
        this.state = 'OPEN';
        logger.error({ provider: this.providerId }, 'Circuit breaker OPEN');
      }
      
      throw error;
    }
  }
}
```

**Alternatives Considered**:
- ❌ **Exponential backoff without breaker**: Accumulates retries, wastes resources
- ❌ **Manual admin intervention required**: Violates "make complexity invisible" principle
- ❌ **Permanent disable**: User loses functionality until manual re-enable

---

### 5. Duplicate Detection Algorithm

**Question**: What similarity algorithm should detect duplicate books across sources?

**Decision**: Levenshtein distance with >85% threshold on normalized title+author

**Rationale**:
- **Simple and proven**: Standard fuzzy matching algorithm
- **Configurable**: Threshold can be tuned based on user feedback
- **Efficient**: O(n*m) acceptable for small candidate sets (<100 books per query)
- **Good enough**: Catches typos, punctuation differences, minor variations

**Normalization**:
```typescript
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

function similarity(a: string, b: string): number {
  const dist = levenshtein(normalize(a), normalize(b));
  const maxLen = Math.max(a.length, b.length);
  return (1 - dist / maxLen) * 100;
}
```

**Matching Strategy** (FR-015a, FR-015b):
- **Manual entry**: Check all existing books, show warning, allow proceed
- **External provider**: Check target provider only (FR-016e), offer upgrade/duplicate
- **Threshold**: >85% similarity on `title + ' ' + author`

**Alternatives Considered**:
- ❌ **ISBN matching**: Many books lack ISBNs (especially physical books)
- ❌ **Cover image similarity**: Computationally expensive, unreliable for different editions
- ❌ **Metadata hash**: Too strict, misses legitimate duplicates with minor differences

---

### 6. Source Migration Data Preservation

**Question**: How should source migration preserve all Tome data during manual→external upgrades?

**Decision**: Transactional update with foreign key cascades and pessimistic locking

**Rationale**:
- **Data integrity**: Transaction ensures all-or-nothing migration
- **Referential integrity**: Foreign key cascades automatically update related records
- **Concurrency safety**: Pessimistic lock prevents race conditions (FR-016f)
- **Audit trail**: Migration logged for debugging (FR-021b)

**Migration Process**:
```typescript
async migrateSource(bookId: number, newSource: string, externalId: string) {
  return db.transaction(async () => {
    // 1. Lock book record
    const book = await db.select()
      .from(books)
      .where(eq(books.id, bookId))
      .for('UPDATE')  // Pessimistic lock
      .get();
    
    // 2. Validate migration rules
    if (book.source !== 'manual') {
      throw new Error('Only manual books can be migrated');
    }
    
    // 3. Check for duplicate in target provider
    const duplicate = await bookRepository.findBySourceAndExternalId(newSource, externalId);
    if (duplicate) {
      throw new Error('Book already exists in target provider');
    }
    
    // 4. Update book record (sessions, progress, ratings cascade automatically)
    await bookRepository.update(bookId, {
      source: newSource,
      externalId: externalId,
      // Optionally update metadata with user confirmation
    });
    
    // 5. Log migration event
    logger.info({
      bookId,
      oldSource: 'manual',
      newSource,
      externalId,
      sessionCount: await sessionRepository.countByBookId(bookId),
      progressCount: await progressRepository.countByBookId(bookId),
    }, 'Source migration completed');
  });
}
```

**Alternatives Considered**:
- ❌ **Create new book + move references**: Complex, error-prone, disrupts foreign keys
- ❌ **Optimistic locking with retry**: Race conditions possible with concurrent UI operations
- ❌ **Soft delete old + create new**: Violates "preserve complete history" principle

---

### 7. Calibre Sync Isolation

**Question**: How should Calibre sync operations be restricted to only affect Calibre-sourced books?

**Decision**: Add `source='calibre'` filter to all sync queries

**Rationale**:
- **Surgical change**: Minimal modification to existing sync logic
- **Constitution compliance**: Enforces "Calibre as source of truth" for Calibre books only
- **Data safety**: Manual and external provider books immune to Calibre sync operations
- **Backward compatible**: Existing books migrated to `source='calibre'` preserve behavior

**Implementation Changes**:
```typescript
// lib/sync-service.ts

// BEFORE:
const orphanedBooks = await bookRepository.findNotInCalibreIds(calibreIds);

// AFTER:
const orphanedBooks = await bookRepository.findNotInCalibreIds(calibreIds, {
  source: 'calibre'  // Only mark Calibre-sourced books as orphaned
});

// BEFORE:
const existingBook = await bookRepository.findByCalibreId(calibreBook.id);

// AFTER:
const existingBook = await bookRepository.findByCalibreId(calibreBook.id, {
  source: 'calibre'  // Only update Calibre-sourced books
});
```

**Alternatives Considered**:
- ❌ **Separate sync services per source**: Code duplication, harder to maintain
- ❌ **Source-specific repositories**: Over-engineered for source filtering use case

---

### 8. Provider Health Monitoring

**Question**: What metrics should trigger provider health state changes?

**Decision**: Binary health states (healthy/unavailable) with circuit breaker integration

**Rationale**:
- **Simplicity**: Binary states clearer than degraded/partial states (per clarification Q33)
- **Automatic detection**: Circuit breaker state machine handles failures without separate monitoring
- **Lightweight**: Health checks piggybacked on normal operations (no separate polling)
- **User-visible**: Health status exposed via API for settings UI

**Health Check Flow**:
```
Provider Operation Attempt
    ↓
Circuit Breaker.execute()
    ↓ (success)        ↓ (failure)
Update health         Increment failure count
status='healthy'      Check if threshold reached (5)
    ↓                     ↓
Continue              Update health status='unavailable'
```

**Alternatives Considered**:
- ❌ **Scheduled health checks**: Adds complexity, wastes API calls for unused providers
- ❌ **Degraded state**: User confusion about what "degraded" means operationally
- ❌ **Response time monitoring**: Over-engineered for single-user deployments

---

### 9. Provider Priority Configuration

**Question**: Should provider priority be user-configurable or hardcoded?

**Decision**: Hardcoded priority for Phase 1 (Hardcover → OpenLibrary)

**Rationale**:
- **Simplicity**: Avoids UI complexity for marginal benefit
- **Sufficient**: Most users don't care about search result ordering
- **Future enhancement**: Can add priority field to provider_configs if users request it
- **Clear default**: Hardcover (curated, higher quality) before OpenLibrary (comprehensive)

**Implementation**:
```typescript
const PROVIDER_PRIORITY: Record<string, number> = {
  hardcover: 1,
  openlibrary: 2,
};

function sortResults(results: SearchResult[]): SearchResult[] {
  return results.sort((a, b) => {
    const priorityDiff = PROVIDER_PRIORITY[a.source] - PROVIDER_PRIORITY[b.source];
    if (priorityDiff !== 0) return priorityDiff;
    return a.index - b.index; // Preserve provider's internal order
  });
}
```

**Alternatives Considered**:
- ❌ **User-configurable priority**: Adds UI complexity, most users won't use it
- ❌ **Machine learning ranking**: Massive over-engineering for book search

---

### 10. External API Integration Patterns

**Question**: How should external API integrations (Hardcover, OpenLibrary) be structured?

**Decision**: Provider-specific service classes with retry logic and rate limit handling

**Rationale**:
- **Encapsulation**: API-specific logic isolated in provider implementations
- **Resilience**: Retry with exponential backoff handles transient failures
- **Rate limiting**: Providers detect rate limit responses and trigger circuit breaker
- **Testability**: Mock HTTP responses without affecting core logic

**Hardcover Provider Structure**:
```typescript
export class HardcoverProvider implements IMetadataProvider {
  id = 'hardcover';
  name = 'Hardcover';
  capabilities = {
    hasSearch: true,
    hasMetadataFetch: true,
    hasSync: false,
    requiresAuth: true,
  };
  
  private apiKey: string;
  private baseUrl = 'https://api.hardcover.app/v1';
  
  async search(query: string): Promise<BookMetadata[]> {
    const response = await this.retryRequest(async () => {
      return fetch(`${this.baseUrl}/books/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000), // 5s timeout
      });
    });
    
    if (response.status === 429) {
      throw new RateLimitError('Hardcover API rate limit exceeded');
    }
    
    return this.parseSearchResults(await response.json());
  }
  
  private async retryRequest<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    // Exponential backoff retry logic
  }
}
```

**OpenLibrary Provider Structure**:
- Public API (no auth required)
- Base URL: `https://openlibrary.org/`
- Search endpoint: `/search.json?q=...`
- Works endpoint: `/works/{OLID}.json`

**Alternatives Considered**:
- ❌ **Shared API client**: Providers have different auth/headers, hard to generalize
- ❌ **No retry logic**: Transient network failures break user experience

---

## Summary of Architectural Decisions

| Area | Decision | Key Benefit |
|------|----------|-------------|
| Provider Interface | TypeScript interface with capability flags | Type safety + runtime flexibility |
| Config Storage | SQLite JSON fields | Self-contained, no external deps |
| Federated Search | Parallel Promise.allSettled | Performance + resilience |
| Circuit Breaker | Per-provider state machine | Automatic failure isolation |
| Duplicate Detection | Levenshtein >85% threshold | Simple, proven, configurable |
| Source Migration | Transactional updates with locking | Data integrity + concurrency safety |
| Calibre Sync | Source filter in queries | Surgical change, preserves isolation |
| Health Monitoring | Binary states + circuit breaker | Simplicity, automatic detection |
| Provider Priority | Hardcoded for Phase 1 | Avoid premature optimization |
| API Integration | Provider-specific services | Encapsulation + testability |

---

## Next Steps

Phase 0 complete. All architectural unknowns resolved. Ready to proceed to Phase 1 (Design & Contracts).

**Phase 1 will generate**:
1. `data-model.md` - Complete entity schemas with relationships
2. `contracts/` - OpenAPI specs for new API routes
3. `quickstart.md` - Developer onboarding guide for provider system
4. Agent context updates - Technology additions for AI assistants
