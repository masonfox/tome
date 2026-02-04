# Calibre Test Fixtures Documentation

> Auto-generated test fixtures for comprehensive Calibre integration testing

**Generated from**: `/home/mason/Calibre Library/metadata.db`  
**Generated on**: 2026-01-04  
**Source library size**: 706 books  
**Calibre schema version**: 6.x (production schema with `books_series_link` table)

---

## Overview

Three test fixtures provide comprehensive coverage for testing `lib/db/calibre.ts`:

| Fixture | Size | Purpose | Books | Schema Variant |
|---------|------|---------|-------|----------------|
| `calibre-test-comprehensive.db` | ~150KB | Main test database | 47 | Full schema |
| `calibre-test-minimal.db` | ~150KB | Schema detection | 47 | Minimal (no isbn/lccn) |
| `calibre-test-series-heavy.db` | ~80KB | Series testing | 25 | Full schema |

---

## Fixture 1: calibre-test-comprehensive.db

**Purpose**: Primary test fixture covering all edge cases and features

### Statistics
- **Books**: 47
- **Authors**: 46
- **Series**: 9
- **Tags**: 168
- **Ratings**: 5 (2, 4, 6, 8, 10 scale)

### Coverage by Category

#### Ratings Coverage
| Rating (Calibre) | Stars | Book Count | Example IDs |
|------------------|-------|------------|-------------|
| 2 | 1★ | 2 | 608, 859 |
| 4 | 2★ | 1 | 905 |
| 6 | 3★ | 2 | 84, 174 |
| 8 | 4★ | 2 | 83, 798 |
| 10 | 5★ | 2 | 90, 147 |

#### Multi-Author Books (GROUP_CONCAT testing)
- ID 40: "10% Happier" - 3 authors (Dan Harris, Jeffrey Warren, Carlye Adler)
- ID 116: "Blue Ocean Strategy" - 2 authors (W. Chan Kim, Renee Mauborgne)
- ID 139: "Trillion Dollar Coach" - 3 authors (Eric Schmidt, Jonathan Rosenberg, Alan Eagle)
- ID 144: "Find Your Why" - 3 authors (Simon Sinek, David Mead, Peter Docker)
- ID 286: "The Little Sisters of Eluria" - 3 authors (Stephen King, Robin Furth, Luke Ross)
- ID 345: "Accelerate" - 3 authors (Nicole Forsgren, Jez Humble, Gene Kim)
- ID 905: "Norwegian Wood" - 2 authors (Haruki Murakami, Jay Rubin)

#### Series Books (books_series_link testing)
| Series | Books | Book IDs | series_index Range |
|--------|-------|----------|--------------------|
| Dune | 8 | 82, 83, 84, 85, 90, 147, 195, 196 | 1.0 - 8.0 |
| A Tale of Magic | 2 | 94, 96 | 1.0 - 2.0 |
| A Series of Unfortunate Events | 2 | 520, 521 | 4.0 - 5.0 |
| A Court of Thorns and Roses | 1 | 859 | 1.0 |
| A Song of Ice and Fire | 1 | 798 | 1.0 |
| The Dark Tower | 1 | 286 | 0.5 (fractional index) |
| Nevermoor | 1 | 302 | 3.0 |
| Witcher Saga | 1 | 418 | 5.0 |
| Very Short Introductions | 1 | 25 | 81.0 (high index) |

#### Tag Count Distribution
| Category | Book Count | Example IDs |
|----------|------------|-------------|
| Many tags (15+) | 5 | 644 (26 tags), 521 (21 tags), 619 (19 tags), 487 (18 tags), 520 (18 tags) |
| Moderate tags (5-14) | 18 | Various |
| Few tags (1-4) | 18 | Various |
| No tags | 6 | 89, 111, 387, 496, 498, 742 |

#### Metadata Edge Cases
| Case | Count | Example IDs | Purpose |
|------|-------|-------------|---------|
| No rating | 38 | Most books | Null rating handling |
| No series | 38 | Various | Null series handling |
| No tags | 6 | 89, 111, 387, 496, 498, 742 | Null tag handling |
| Minimal metadata (no rating/series/tags) | 6 | 89, 111, 387, 496, 498, 742, 879, 881, 883 | Complete null testing |
| Long titles (100+ chars) | 2 | 184 (131 chars), 89 (114 chars) | String length edge cases |
| Fractional series_index | 1 | 286 (0.5) | Decimal series_index |
| High series_index | 1 | 25 (81.0) | Large index numbers |

### Known Test Books (Deterministic Testing)

#### Books for Rating Conversion Tests
```typescript
// lib/db/calibre.ts lines 131-135, 196-200, 259-263
expect(getBookById(608)?.rating).toBe(1);  // Calibre: 2 → 1★
expect(getBookById(905)?.rating).toBe(2);  // Calibre: 4 → 2★
expect(getBookById(84)?.rating).toBe(3);   // Calibre: 6 → 3★
expect(getBookById(83)?.rating).toBe(4);   // Calibre: 8 → 4★
expect(getBookById(90)?.rating).toBe(5);   // Calibre: 10 → 5★
expect(getBookById(147)?.rating).toBe(5);  // Calibre: 10 → 5★
expect(getBookById(25)?.rating).toBeNull(); // No rating
```

#### Books for Series Tests
```typescript
// Complete Dune series for series_index testing
const duneBooks = getAllBooks().filter(b => b.series === 'Dune');
expect(duneBooks).toHaveLength(8);
expect(duneBooks.find(b => b.id === 147)?.series_index).toBe(1.0); // Dune
expect(duneBooks.find(b => b.id === 286)?.series_index).toBe(0.5); // Fractional index
```

#### Books for getAllBookTags Tests
```typescript
// lib/db/calibre.ts lines 290-328
const tagsMap = getAllBookTags();
expect(tagsMap.get(644)).toHaveLength(26);  // "Columbine" - most tags
expect(tagsMap.get(521)).toHaveLength(21);  // "Unfortunate Events 5"
expect(tagsMap.get(89)).toBeUndefined();    // No tags
```

#### Books for Multi-Author Tests
```typescript
// GROUP_CONCAT with multiple authors
expect(getBookById(40)?.authors).toContain('Dan Harris');
expect(getBookById(40)?.authors).toContain('Jeffrey Warren');
expect(getBookById(40)?.authors).toContain('Carlye Adler');
```

### Complete Book List

See query results above for full listing of all 47 books with their metadata.

---

## Fixture 2: calibre-test-minimal.db

**Purpose**: Test schema detection when optional columns are missing

### Schema Modifications
- **Removed columns**: `books.isbn`, `books.lccn`
- **Books table columns**: 12 (vs 14 in full schema)
- **All other tables**: Unchanged

### Statistics
- **Books**: 47 (same as comprehensive)
- **Authors**: 46
- **Tags**: 168
- **Ratings**: 5

### Testing Focus
Tests that `lib/db/calibre.ts` lines 78-92 correctly detect missing columns:
```typescript
const columns = db.prepare("PRAGMA table_info(books)").all();
const columnNames = columns.map(c => c.name);
const hasPublisher = columnNames.includes('publisher'); // Should be false
```

### Known Test Cases
```typescript
// Should handle missing columns gracefully
const book = getBookById(147); // "Dune"
expect(book.title).toBe("Dune");
expect(book.isbn).toBeNull(); // Column doesn't exist → null
```

---

## Fixture 3: calibre-test-series-heavy.db

**Purpose**: Comprehensive testing of `books_series_link` table and series functionality

### Statistics
- **Books**: 25
- **Series**: 3
- **Authors**: 4

### Series Coverage

#### A Court of Thorns and Roses (5 books)
- Complete series testing
- Tests sequential series_index (1.0, 2.0, 3.0, 3.5, 4.0)
- Tests fractional series_index (3.5)

#### A Series of Unfortunate Events (13 books)
- Large series testing
- Tests series_index 1.0 through 10.0 (at minimum)
- Tests pagination with series filtering

#### Foundation Series (~7 books)
- Classic sci-fi series
- Tests series with gaps in series_index

### Testing Focus
```typescript
// Test books_series_link table behavior (production Calibre schema)
const seriesBooks = getAllBooks().filter(b => b.series === 'A Court of Thorns and Roses');
expect(seriesBooks).toHaveLength(5);
expect(seriesBooks.map(b => b.series_index)).toEqual([1.0, 2.0, 3.0, 3.5, 4.0]);

// Test large series pagination
const unfortunateBooks = getAllBooks({ limit: 5 }).filter(b => 
  b.series === 'A Series of Unfortunate Events'
);
```

---

## Regenerating Fixtures

To regenerate all fixtures from your Calibre library:

```bash
cd scripts/fixtures
./generate-fixtures.sh  # Generates all 3 fixtures in one run
```

**Prerequisites**:
- Source Calibre database: `/home/mason/Calibre Library/metadata.db`
- SQLite3 installed
- Bash shell

**Time**: ~5-10 seconds total

---

## Fixture Validation

Each fixture includes built-in validation:
- Book count checks
- Schema verification
- Foreign key integrity (implicit via SQLite)
- Data completeness checks

### Manual Validation
```bash
# Check fixture integrity
sqlite3 __tests__/fixtures/calibre-test-comprehensive.db "
  SELECT 
    (SELECT COUNT(*) FROM books) as books,
    (SELECT COUNT(*) FROM authors) as authors,
    (SELECT COUNT(*) FROM tags) as tags,
    (SELECT COUNT(*) FROM ratings) as ratings,
    (SELECT COUNT(*) FROM series) as series;
"

# Expected output:
# books|authors|tags|ratings|series
# 47|46|168|5|9
```

---

## Version History

- **v1.0.0** (2026-01-04): Initial fixtures generated from production Calibre library
  - 47 books in comprehensive fixture
  - 5 rating values (2,4,6,8,10)
  - 9 series with 18 books
  - 7 multi-author books
  - 168 unique tags
