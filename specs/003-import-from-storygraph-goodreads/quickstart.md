# Quickstart Guide: Import Books from TheStoryGraph & Goodreads

**Spec**: 003  
**Date**: 2025-12-01  
**For**: Developers implementing or extending the import feature

---

## Overview

This guide helps developers quickly understand and work with Tome's book import feature. It covers architecture, key files, testing, and common development workflows.

**What This Feature Does:**
- Import reading history from Goodreads/TheStoryGraph CSV files
- Match imported books to existing Calibre library entries (ISBN + fuzzy matching)
- Create reading sessions with preserved history
- Sync ratings bidirectionally with Calibre
- Handle edge cases (re-reads, duplicates, unmatched books)

**Key Constraints:**
- Calibre is source of truth for books (read-only except ratings)
- No external APIs (CSV-only)
- 10 MB file size limit
- Single-user import (no concurrent imports)
- Transaction-based with rollback on error

---

## Architecture Overview

### Request Flow

```
CSV Upload → Parse → Match → Preview → Execute → Sessions/Ratings
     ↓         ↓       ↓        ↓         ↓            ↓
   Route   Service  Service    API    Service    Repositories
```

### Three-Layer Pattern

```
┌─────────────────────────────────────────────────┐
│ API Routes (app/api/import/)                    │
│ - Thin orchestrators (30-50 lines)              │
│ - Request validation (Zod schemas)              │
│ - Response formatting                           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ Services (lib/services/)                        │
│ - Business logic (matching, normalization)      │
│ - Transaction coordination                      │
│ - Error handling & logging                      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ Repositories (lib/repositories/)                │
│ - Database access (Drizzle ORM)                 │
│ - CRUD operations                               │
│ - Query builders                                │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
1. Upload CSV
   POST /api/import/upload
   ↓
   csvParserService.parse(file) → ImportRecord[]
   ↓
   bookMatcherService.matchRecords(records) → MatchResult[]
   ↓
   importLogRepository.create() → importId
   ↓
   Return preview statistics

2. Review Preview
   GET /api/import/:importId/preview
   ↓
   importLogRepository.findById(importId)
   ↓
   Return detailed matches + unmatched records

3. Execute Import
   POST /api/import/:importId/execute
   ↓
   sessionImporterService.createSessions(matches)
   ↓
   bookService.updateRatings(ratings)
   ↓
   calibreService.updateCalibreRating(bookId, rating)
   ↓
   unmatchedRecordRepository.createMany(unmatched)
   ↓
   importLogRepository.updateStatus(importId, 'success')
```

---

## Key Files

### API Routes (Entry Points)

| File | Method | Purpose | Lines |
|------|--------|---------|-------|
| `app/api/import/upload/route.ts` | POST | Upload CSV, parse, match | ~150 |
| `app/api/import/[importId]/preview/route.ts` | GET | Get match preview | ~80 |
| `app/api/import/[importId]/execute/route.ts` | POST | Execute import | ~200 |
| `app/api/import/[importId]/unmatched/route.ts` | GET | Export unmatched | ~60 |

### Services (Business Logic)

| File | Key Functions | Purpose |
|------|---------------|---------|
| `lib/services/import.service.ts` | `orchestrateImport()` | Main import coordinator |
| `lib/services/csv-parser.service.ts` | `parseCSV()`, `validateProvider()` | CSV parsing + normalization |
| `lib/services/book-matcher.service.ts` | `matchByISBN()`, `fuzzyMatch()` | Book matching algorithms |
| `lib/services/session-importer.service.ts` | `createSessions()`, `detectDuplicates()` | Session creation logic |

### Repositories (Data Access)

| File | Methods | Table |
|------|---------|-------|
| `lib/repositories/import-log.repository.ts` | `create()`, `findById()`, `updateStatus()` | `import_logs` |
| `lib/repositories/unmatched-record.repository.ts` | `createMany()`, `findByImportId()` | `import_unmatched_records` |
| `lib/repositories/book.repository.ts` | `findByISBN()`, `findAll()` | `books` (existing) |
| `lib/repositories/session.repository.ts` | `create()`, `findDuplicates()` | `reading_sessions` (existing) |

### Database Schema

| File | Table | Purpose |
|------|-------|---------|
| `lib/db/schema/import-logs.ts` | `import_logs` | Audit trail for imports |
| `lib/db/schema/import-unmatched-records.ts` | `import_unmatched_records` | Unmatched records storage |

### Utilities

| File | Functions | Purpose |
|------|-----------|---------|
| `lib/utils/isbn-normalizer.ts` | `normalizeISBN()`, `validateISBN()` | ISBN cleaning |
| `lib/utils/string-similarity.ts` | `cosineSimilarity()`, `levenshteinDistance()` | Fuzzy matching |
| `lib/utils/date-parser.ts` | `parseFlexibleDate()` | Multi-format date parsing |

---

## Quick Start

### 1. Development Setup

```bash
# Install dependencies
bun install

# Run migrations (creates import_logs + unmatched_records tables)
bun run db:migrate

# Start dev server
bun run dev
```

### 2. Test the Import Flow

```bash
# Upload a CSV (provider must be explicitly specified)
curl -X POST http://localhost:3000/api/import/upload \
  -F "file=@/path/to/goodreads.csv" \
  -F "provider=goodreads"

# Response:
{
  "success": true,
  "importId": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "goodreads",
  "totalRecords": 234,
  "preview": {
    "exactMatches": 180,
    "highConfidenceMatches": 32,
    "lowConfidenceMatches": 8,
    "unmatchedRecords": 14
  }
}

# Get detailed preview
curl http://localhost:3000/api/import/550e8400-e29b-41d4-a716-446655440000/preview

# Execute import
curl -X POST http://localhost:3000/api/import/550e8400-e29b-41d4-a716-446655440000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "confirmedMatches": ["match-1", "match-2"],
    "skipRecords": ["unmatched-1"],
    "forceDuplicates": false
  }'
```

### 3. Run Tests

```bash
# Unit tests (CSV parsing, matching algorithms)
bun test __tests__/lib/csv-parser.service.test.ts
bun test __tests__/lib/book-matcher.service.test.ts

# Integration tests (full import workflow)
bun test __tests__/integration/api/import-upload.test.ts
bun test __tests__/integration/api/import-execute.test.ts

# API contract tests
bun test __tests__/api/import/upload.test.ts

# Run all import tests
bun test __tests__ --grep "import"
```

---

## Common Development Tasks

### Add a New CSV Provider

**1. Add Provider Type**
```typescript
// lib/db/schema/import-logs.ts
export const providerEnum = sqliteEnum('provider', [
  'goodreads',
  'storygraph',
  'new-provider', // Add here
]);
```

**2. Implement Parser & Validation**
```typescript
// lib/services/csv-parser.service.ts
export class CsvParserService {
  validateProvider(provider: Provider, headers: string[]): boolean {
    const requiredColumns = {
      'goodreads': ['Book Id', 'Title', 'Author', 'My Rating', 'Date Read'],
      'storygraph': ['Title', 'Authors', 'Read Status', 'Star Rating'],
      'new-provider': ['Title Column', 'Author Column', 'Date Column'], // Add here
    };

    const required = requiredColumns[provider];
    return required.every(col => headers.includes(col));
  }

  parseNewProvider(row: any): ImportRecord {
    return {
      title: row['Title Column'],
      author: row['Author Column'],
      // Map provider columns to ImportRecord
    };
  }
}
```

**3. Update Frontend**
```typescript
// app/import/page.tsx - Add to provider selection
<select name="provider">
  <option value="goodreads">Goodreads</option>
  <option value="storygraph">TheStoryGraph</option>
  <option value="new-provider">New Provider</option>
</select>
```

**4. Add Tests**
```typescript
// __tests__/lib/csv-parser.service.test.ts
describe('parseNewProvider', () => {
  it('should validate new provider columns', () => {
    const headers = ['Title Column', 'Author Column', 'Date Column'];
    const isValid = csvParserService.validateProvider('new-provider', headers);
    expect(isValid).toBe(true);
  });

  it('should parse new provider CSV format', () => {
    const csvContent = `Title Column,Author Column\nBook1,Author1`;
    const result = csvParserService.parse(csvContent, 'new-provider');
    expect(result.records).toHaveLength(1);
  });
});
```

---

### Improve Matching Algorithm

**Current Algorithm:**
1. **Tier 1 (100%)**: ISBN exact match with title validation
2. **Tier 2 (85-95%)**: Fuzzy title + author match (cosine similarity)
3. **Tier 3 (70-84%)**: Low confidence (manual review)

**To Modify Thresholds:**
```typescript
// lib/services/book-matcher.service.ts
export class BookMatcherService {
  private readonly THRESHOLDS = {
    EXACT: 1.0,           // 100% - ISBN match
    HIGH: 0.85,           // 85% - High confidence fuzzy
    MEDIUM: 0.70,         // 70% - Medium confidence
    MINIMUM: 0.60,        // 60% - Below this, no match
  };

  // Adjust these values based on testing/feedback
}
```

**To Add New Matching Strategy:**
```typescript
// lib/services/book-matcher.service.ts
export class BookMatcherService {
  matchRecords(records: ImportRecord[], books: Book[]): MatchResult[] {
    return records.map(record => {
      // Try ISBN first
      let match = this.matchByISBN(record, books);
      if (match) return match;

      // Try fuzzy title/author
      match = this.fuzzyMatch(record, books);
      if (match) return match;

      // NEW: Try series match
      match = this.matchBySeries(record, books);
      if (match) return match;

      return { confidence: 0, reason: 'no_match' };
    });
  }

  private matchBySeries(record: ImportRecord, books: Book[]): MatchResult | null {
    // Extract series from title (e.g., "Book Title (Series #1)")
    const seriesMatch = record.title.match(/\((.+?) #(\d+)\)/);
    if (!seriesMatch) return null;

    const [_, seriesName, bookNumber] = seriesMatch;
    // Search for series in Calibre metadata...
  }
}
```

---

### Add New Import Options

**1. Define Option in Schema**
```typescript
// lib/services/import.service.ts
export interface ImportOptions {
  syncRatings: boolean;          // Existing
  createSessions: boolean;       // Existing
  skipExistingSessions: boolean; // Existing
  updateReadDates: boolean;      // NEW: Update existing session dates
  mergeReviews: boolean;         // NEW: Combine reviews if duplicate
}
```

**2. Implement Option Logic**
```typescript
// lib/services/session-importer.service.ts
export class SessionImporterService {
  async createSessions(
    matches: MatchResult[],
    options: ImportOptions
  ): Promise<SessionResult> {
    const sessions = [];
    
    for (const match of matches) {
      const existing = await this.findDuplicate(match);
      
      if (existing && options.updateReadDates) {
        // NEW: Update existing session dates instead of skipping
        await sessionRepository.update(existing.id, {
          startedDate: match.importData.startedDate,
          completedDate: match.importData.completedDate,
        });
        continue;
      }
      
      if (existing && options.skipExistingSessions) {
        continue; // Skip duplicate
      }
      
      // Create new session...
    }
  }
}
```

**3. Expose in API**
```typescript
// app/api/import/[importId]/execute/route.ts
const executeSchema = z.object({
  confirmedMatches: z.array(z.string()),
  skipRecords: z.array(z.string()),
  forceDuplicates: z.boolean().default(false),
  options: z.object({
    syncRatings: z.boolean().default(true),
    createSessions: z.boolean().default(true),
    skipExistingSessions: z.boolean().default(true),
    updateReadDates: z.boolean().default(false),       // NEW
    mergeReviews: z.boolean().default(false),          // NEW
  }).optional(),
});
```

---

### Debug Import Issues

**1. Enable Verbose Logging**
```typescript
// lib/services/import.service.ts
import { logger } from '@/lib/logger';

export class ImportService {
  async orchestrateImport(file: File): Promise<ImportResult> {
    logger.info({ fileName: file.name }, 'Starting import');
    
    const records = await csvParserService.parse(file);
    logger.debug({ recordCount: records.length }, 'Parsed CSV records');
    
    const matches = await bookMatcherService.matchRecords(records);
    logger.info({
      exact: matches.filter(m => m.confidence === 100).length,
      high: matches.filter(m => m.confidence >= 85).length,
      low: matches.filter(m => m.confidence >= 70).length,
      unmatched: matches.filter(m => m.confidence === 0).length,
    }, 'Matching complete');
  }
}
```

**2. Inspect Database State**
```bash
# View import logs
sqlite3 data/tome.db "SELECT * FROM import_logs ORDER BY createdAt DESC LIMIT 10;"

# View unmatched records
sqlite3 data/tome.db "SELECT title, authors, reason FROM import_unmatched_records WHERE importLogId = 15;"

# Check for duplicate sessions
sqlite3 data/tome.db "
  SELECT bookId, startedDate, completedDate, COUNT(*) as count
  FROM reading_sessions
  GROUP BY bookId, startedDate, completedDate
  HAVING count > 1;
"
```

**3. Test with Sample Data**
```typescript
// __tests__/fixtures/test-data.ts
export const sampleGoodreadsCSV = `
Book Id,Title,Author,ISBN13,My Rating,Date Read,Exclusive Shelf
12345,"Dune","Frank Herbert","9780441013593","5","2023/05/21","read"
67890,"Project Hail Mary","Andy Weir",,"5","2024/11/15","read"
`;

// Use in tests
const result = await csvParserService.parse(sampleGoodreadsCSV);
expect(result.records).toHaveLength(2);
```

---

## Testing Patterns

### Unit Tests (Isolated Logic)

```typescript
// __tests__/lib/book-matcher.service.test.ts
import { BookMatcherService } from '@/lib/services/book-matcher.service';

describe('BookMatcherService', () => {
  let service: BookMatcherService;

  beforeEach(() => {
    service = new BookMatcherService();
  });

  describe('matchByISBN', () => {
    it('should match exact ISBN-13', () => {
      const record = { isbn13: '9780441013593', title: 'Dune' };
      const books = [
        { id: 1, isbn: '9780441013593', title: 'Dune (Dune #1)' }
      ];

      const result = service.matchByISBN(record, books);

      expect(result.confidence).toBe(100);
      expect(result.matchedBook.id).toBe(1);
      expect(result.matchReason).toBe('ISBN-13 exact match');
    });

    it('should reject ISBN match with mismatched title', () => {
      const record = { isbn13: '9780441013593', title: 'Wrong Book' };
      const books = [
        { id: 1, isbn: '9780441013593', title: 'Dune (Dune #1)' }
      ];

      const result = service.matchByISBN(record, books);

      expect(result).toBeNull(); // Title mismatch = no match
    });
  });

  describe('fuzzyMatch', () => {
    it('should match similar titles with high confidence', () => {
      const record = { title: 'Project Hail Mary', author: 'Andy Weir' };
      const books = [
        { id: 2, title: 'Project Hail Mary', authors: ['Andy Weir'] }
      ];

      const result = service.fuzzyMatch(record, books);

      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.matchedBook.id).toBe(2);
    });

    it('should handle subtitle variations', () => {
      const record = { title: 'Dune', author: 'Frank Herbert' };
      const books = [
        { id: 1, title: 'Dune (Dune #1)', authors: ['Frank Herbert'] }
      ];

      const result = service.fuzzyMatch(record, books);

      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });
  });
});
```

### Integration Tests (Full Workflow)

```typescript
// __tests__/integration/api/import-upload.test.ts
import { POST } from '@/app/api/import/upload/route';
import { createTestDatabase, resetDatabase } from '@/__tests__/helpers/db-setup';
import { sampleGoodreadsCSV } from '@/__tests__/fixtures/test-data';

describe('POST /api/import/upload', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('should upload and parse Goodreads CSV', async () => {
    const file = new File([sampleGoodreadsCSV], 'goodreads.csv', {
      type: 'text/csv'
    });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost:3000/api/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.importId).toBeDefined();
    expect(data.provider).toBe('goodreads');
    expect(data.totalRecords).toBe(2);
    expect(data.preview.exactMatches).toBeGreaterThan(0);
  });

  it('should reject invalid CSV format', async () => {
    const invalidCSV = 'Not,A,Valid,Goodreads\nCSV,Format,Here,Nope';
    const file = new File([invalidCSV], 'invalid.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost:3000/api/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid CSV format');
  });
});
```

### API Contract Tests

```typescript
// __tests__/api/import/upload.test.ts
import { POST } from '@/app/api/import/upload/route';
import { uploadResponseSchema } from '@/lib/schemas/import.schema';

describe('POST /api/import/upload - API Contract', () => {
  it('should return response matching OpenAPI schema', async () => {
    const file = new File([sampleGoodreadsCSV], 'goodreads.csv');
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost:3000/api/import/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    // Validate response against Zod schema (derived from OpenAPI)
    const parsed = uploadResponseSchema.safeParse(data);
    expect(parsed.success).toBe(true);

    // Validate required fields
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('importId');
    expect(data).toHaveProperty('provider');
    expect(data).toHaveProperty('totalRecords');
    expect(data).toHaveProperty('preview');
    expect(data.preview).toHaveProperty('exactMatches');
    expect(data.preview).toHaveProperty('highConfidenceMatches');
    expect(data.preview).toHaveProperty('lowConfidenceMatches');
    expect(data.preview).toHaveProperty('unmatchedRecords');
  });
});
```

---

## Performance Optimization

### Current Performance Targets

- **Parse 1000 CSV records**: <5 seconds
- **Match 1000 × 5000 books**: <30 seconds (5M comparisons)
- **Insert 1000 sessions**: <10 seconds
- **Total end-to-end**: <60 seconds

### Optimization Strategies

**1. Batch Processing**
```typescript
// lib/services/session-importer.service.ts
export class SessionImporterService {
  async createSessions(matches: MatchResult[]): Promise<void> {
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
      const batch = matches.slice(i, i + BATCH_SIZE);
      
      await db.transaction(async (tx) => {
        await tx.insert(readingSessions).values(batch);
      });
    }
  }
}
```

**2. In-Memory Matching Cache**
```typescript
// lib/services/book-matcher.service.ts
export class BookMatcherService {
  private isbnIndex: Map<string, Book>;
  private titleIndex: Map<string, Book[]>;

  constructor(books: Book[]) {
    // Build indexes once
    this.isbnIndex = new Map(books.map(b => [b.isbn, b]));
    this.titleIndex = this.buildTitleIndex(books);
  }

  matchByISBN(record: ImportRecord): MatchResult | null {
    // O(1) lookup instead of O(n) scan
    const book = this.isbnIndex.get(record.isbn13);
    return book ? { confidence: 100, matchedBook: book } : null;
  }
}
```

**3. Streaming CSV Parsing**
```typescript
// lib/services/csv-parser.service.ts
import { parse } from 'csv-parse';

export class CsvParserService {
  async *parseStream(file: File): AsyncGenerator<ImportRecord> {
    const stream = file.stream();
    const parser = parse({ columns: true });

    for await (const row of stream.pipeThrough(parser)) {
      yield this.normalizeRecord(row);
    }
  }
}
```

**4. Parallel Matching (for large imports)**
```typescript
// lib/services/book-matcher.service.ts
export class BookMatcherService {
  async matchRecordsParallel(
    records: ImportRecord[],
    books: Book[]
  ): Promise<MatchResult[]> {
    const CHUNK_SIZE = 250;
    const chunks = this.chunkArray(records, CHUNK_SIZE);

    const results = await Promise.all(
      chunks.map(chunk => this.matchChunk(chunk, books))
    );

    return results.flat();
  }
}
```

---

## Common Pitfalls

### 1. ISBN Format Mismatches

**Problem**: Goodreads uses ISBN-13, Calibre might have ISBN-10 or both.

**Solution**: Normalize before comparison.
```typescript
// lib/utils/isbn-normalizer.ts
export function normalizeISBN(isbn: string): string {
  // Remove hyphens, spaces
  const clean = isbn.replace(/[-\s]/g, '');
  
  // Convert ISBN-10 to ISBN-13
  if (clean.length === 10) {
    return convertISBN10to13(clean);
  }
  
  return clean;
}
```

### 2. Date Format Variations

**Problem**: Goodreads uses "YYYY/MM/DD", TheStoryGraph uses "YYYY-MM-DD".

**Solution**: Flexible date parser.
```typescript
// lib/utils/date-parser.ts
export function parseFlexibleDate(dateStr: string): Date | null {
  const formats = [
    /^\d{4}\/\d{2}\/\d{2}$/,  // 2024/12/01
    /^\d{4}-\d{2}-\d{2}$/,    // 2024-12-01
    /^\d{2}\/\d{2}\/\d{4}$/,  // 12/01/2024
  ];
  
  for (const format of formats) {
    if (format.test(dateStr)) {
      return new Date(dateStr);
    }
  }
  
  return null;
}
```

### 3. Duplicate Session Detection

**Problem**: User imports same CSV twice.

**Solution**: Check for existing sessions before insert.
```typescript
// lib/services/session-importer.service.ts
async findDuplicate(match: MatchResult): Promise<Session | null> {
  return sessionRepository.findOne({
    bookId: match.matchedBook.id,
    startedDate: match.importData.startedDate,
    completedDate: match.importData.completedDate,
  });
}
```

### 4. Transaction Rollback on Error

**Problem**: Partial imports leave database in inconsistent state.

**Solution**: Wrap all writes in transaction.
```typescript
// lib/services/import.service.ts
async executeImport(importId: string): Promise<ExecuteResult> {
  return db.transaction(async (tx) => {
    try {
      // Create sessions
      await sessionImporterService.createSessions(matches, tx);
      
      // Sync ratings (Calibre writes outside transaction)
      const ratingSyncResults = await this.syncRatings(matches);
      
      // Update import log
      await importLogRepository.updateStatus(importId, 'success', tx);
      
      return { success: true };
    } catch (error) {
      // Transaction auto-rolls back
      await importLogRepository.updateStatus(importId, 'failed', tx);
      throw error;
    }
  });
}
```

---

## API Reference (Quick Lookup)

### POST /api/import/upload

**Request:**
```typescript
Content-Type: multipart/form-data
Body: { 
  file: File,
  provider: 'goodreads' | 'storygraph' // Required: user must explicitly select
}
```

**Response:**
```typescript
{
  success: boolean;
  importId: string; // UUID
  provider: 'goodreads' | 'storygraph';
  totalRecords: number;
  preview: {
    exactMatches: number;
    highConfidenceMatches: number;
    lowConfidenceMatches: number;
    unmatchedRecords: number;
  };
}
```

### GET /api/import/:importId/preview

**Response:**
```typescript
{
  success: boolean;
  import: ImportMetadata;
  matches: MatchPreview[];
  unmatched: UnmatchedPreview[];
  pagination: { total, limit, offset, hasMore };
}
```

### POST /api/import/:importId/execute

**Request:**
```typescript
{
  confirmedMatches: string[]; // Match IDs
  skipRecords: string[];      // Unmatched IDs
  forceDuplicates: boolean;
  options?: {
    syncRatings: boolean;
    createSessions: boolean;
    skipExistingSessions: boolean;
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  summary: {
    sessionsCreated: number;
    sessionsSkipped: number;
    ratingsSync: number;
    calibreSyncFailures: number;
    unmatchedRecords: number;
    executionTimeMs: number;
  };
  importLogId: number;
  status: 'success' | 'partial' | 'failed';
}
```

---

## Resources

### Documentation
- **Full Spec**: `specs/003-import-from-storygraph-goodreads/spec.md`
- **Data Model**: `specs/003-import-from-storygraph-goodreads/data-model.md`
- **Research**: `specs/003-import-from-storygraph-goodreads/research.md`
- **OpenAPI Contracts**: `specs/003-import-from-storygraph-goodreads/contracts/`

### Related Code Patterns
- **Repository Pattern**: `docs/REPOSITORY_PATTERN_GUIDE.md`
- **Testing Guidelines**: `docs/TESTING_GUIDELINES.md`
- **Architecture Overview**: `docs/ARCHITECTURE.md`

### Dependencies
- **CSV Parsing**: [`csv-parse` on npm](https://csv.js.org/parse/)
- **String Similarity**: [`fastest-levenshtein` on npm](https://www.npmjs.com/package/fastest-levenshtein)
- **Drizzle ORM**: [Drizzle Docs](https://orm.drizzle.team/)
- **Zod Validation**: [Zod Docs](https://zod.dev/)

---

## Getting Help

**Common Questions:**

1. **Where do I add logging?**  
   Use Pino logger: `import { logger } from '@/lib/logger';`

2. **How do I test with real databases?**  
   See `__tests__/helpers/db-setup.ts` for `createTestDatabase()`.

3. **What if matching is too slow?**  
   Check `BookMatcherService` indexes and consider caching strategies above.

4. **How do I handle new CSV columns?**  
   Add to `CsvParserService.parse()` normalization logic.

5. **Can I run multiple imports concurrently?**  
   No. Single-user import enforced via database locks.

**Need more help?** Check existing tests in `__tests__/` for usage examples.

---

**Last Updated**: 2025-12-01  
**Spec Version**: 003  
**Status**: Phase 1 - Design Complete
