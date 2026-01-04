# Calibre Test Fixtures

This directory contains SQLite database fixtures extracted from a production Calibre library for testing `lib/db/calibre.ts`.

## Fixtures

### 1. calibre-test-comprehensive.db (Main Fixture)
- **47 books** with diverse metadata coverage
- Tests: ratings, series, tags, multi-author books, edge cases
- Use for: All general Calibre integration tests
- **Size**: ~150KB

### 2. calibre-test-minimal.db (Schema Variant)
- **47 books** (same as comprehensive)
- **Modified schema**: Missing `books.isbn` and `books.lccn` columns
- Use for: Testing schema detection logic
- **Size**: ~150KB

### 3. calibre-test-series-heavy.db (Series Focus)
- **25 books** from 3 complete series
- Use for: Testing `books_series_link` table and `series_index`
- **Size**: ~80KB

## Documentation

See [CALIBRE_TEST_DATA.md](./CALIBRE_TEST_DATA.md) for:
- Complete book listings with IDs
- Known test data for deterministic testing
- Coverage statistics
- Regeneration instructions

## Usage in Tests

```typescript
import { Database } from "bun:sqlite";
import path from "path";

describe("Calibre Query Functions", () => {
  let calibreDb: Database;

  beforeAll(() => {
    const dbPath = path.join(__dirname, "fixtures", "calibre-test-comprehensive.db");
    calibreDb = new Database(dbPath, { readonly: true });
    mockGetCalibreDB = mock(() => calibreDb);
  });

  test("should fetch book with rating", () => {
    const book = getBookById(147); // Known: "Dune" - 5★
    expect(book.rating).toBe(5);
  });
});
```

## Regenerating Fixtures

If the source Calibre library changes or you need to update fixtures:

```bash
cd scripts/fixtures
./generate-fixtures.sh  # Generates all 3 fixtures
```

**Requirements**:
- Source DB: `/home/mason/Calibre Library/metadata.db`
- SQLite3 installed
- Time: ~5-10 seconds

## Fixture Integrity

All fixtures are:
- ✅ Read-only (tests open with `readonly: true`)
- ✅ Self-contained (include all referenced authors, tags, series, ratings)
- ✅ Valid Calibre schema (compatible with production Calibre databases)
- ✅ Small (~150KB each, safe for git)
- ✅ Documented (known IDs for deterministic testing)

## Benefits Over In-Memory Tests

| Aspect | In-Memory (Old) | Real Fixtures (New) |
|--------|-----------------|---------------------|
| Schema accuracy | Manual (drift risk) | Extracted from production ✅ |
| Test setup | 120+ lines of schema creation | 5 lines to open DB ✅ |
| Maintenance | High (schema must be kept in sync) | Low (regenerate script) ✅ |
| Real-world data | Synthetic | Real Calibre data ✅ |
| Edge cases | Manual creation | Natural distribution ✅ |
| Test reliability | Schema drift possible | Tests actual Calibre behavior ✅ |

## Schema Version

All fixtures use **Calibre 6.x schema** with:
- `books_series_link` table (production schema)
- All standard Calibre tables and constraints
- `ratings` table with CHECK constraint (rating > -1 AND rating < 11)
- UNIQUE constraints on link tables
- COLLATE NOCASE on text columns
