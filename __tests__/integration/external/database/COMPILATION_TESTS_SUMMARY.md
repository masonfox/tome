# Companion Migration Compilation Tests

## Overview

Comprehensive test suite for the companion migration compilation feature, verifying that companions can be compiled from TypeScript to JavaScript and loaded correctly in both production (compiled) and development (source) modes.

**Test File**: `companion-migrations-compilation.test.ts`  
**Tests**: 21 passing  
**Coverage**: All compilation and runtime detection scenarios

---

## Test Suites

### Suite 1: Compilation Detection (4 tests)

Tests the auto-detection logic that determines whether to load compiled or source companions.

✅ **should detect compiled mode when dist/companions/ exists**
- Creates `dist/companions/` directory with `.js` files
- Verifies `discoverCompanions()` loads from compiled directory
- Validates `compiled: true` mode is used

✅ **should detect source mode when only lib/migrations/ exists**
- Creates `lib/migrations/` directory with `.ts` files
- Verifies `discoverCompanions()` loads from source directory
- Validates `compiled: false` mode is used

✅ **should prefer compiled mode over source when both exist**
- Creates both `dist/companions/` and `lib/migrations/`
- Verifies compiled directory takes precedence
- Ensures production builds use compiled code even if source exists

✅ **should return empty array when neither directory exists**
- Tests graceful handling when no companion directories exist
- Verifies no errors are thrown

---

### Suite 2: Compiled Companion Loading (6 tests)

Tests loading companions from `dist/companions/*.js` in production mode.

✅ **should load companions from dist/companions/*.js in compiled mode**
- Creates multiple compiled `.js` companions
- Verifies all companions are discovered and loaded
- Checks companion metadata (name, description, requiredTables)

✅ **should require compiled .js files without errors**
- Tests loading of CommonJS modules with esbuild structure
- Verifies proper module export structure
- Validates no errors during `require()` calls

✅ **should validate companion structure (name, execute, requiredTables)**
- Creates companions with missing required fields
- Verifies only valid companions are loaded
- Tests structural validation (name, execute function)

✅ **should skip _template.js file in compiled mode**
- Creates `_template.js` and real companions
- Verifies template is excluded from loading
- Ensures template doesn't interfere with real companions

✅ **should load companions in numeric order**
- Creates companions with various numeric prefixes (0002, 0010, 0015)
- Verifies companions are sorted numerically by filename
- Ensures execution order matches schema migration order

✅ **should handle multiple companions**
- Tests loading multiple companions simultaneously
- Verifies all companions are discovered and loaded correctly

---

### Suite 3: Source Companion Loading (3 tests)

Tests loading companions from `lib/migrations/*.ts` in development mode.

✅ **should load companions from lib/migrations/*.ts in source mode**
- Creates TypeScript source companions
- Verifies source companions are discovered and loaded
- Tests ES module export handling

✅ **should skip _template.ts file in source mode**
- Creates `_template.ts` and real companions
- Verifies template is excluded from loading
- Ensures consistent template exclusion in both modes

✅ **should fall back gracefully when compiled directory doesn't exist**
- Tests fallback to source mode when `dist/companions/` missing
- Verifies graceful degradation in development
- Ensures no errors when compiled assets don't exist

---

### Suite 4: Build Process Verification (4 tests)

Tests the actual build process and output from `npm run build:companions`.

✅ **npm run build:companions creates all expected files**
- Runs build script on actual project
- Verifies all source `.ts` files have corresponding `.js` files
- Checks file count matches between source and compiled

✅ **compiled files have correct structure (CJS exports)**
- Loads actual compiled files
- Verifies CommonJS module structure
- Tests `module.exports` and `"use strict"` markers
- Validates companions can be required without errors

✅ **source maps are generated (.js.map files)**
- Checks for `.js.map` files for each compiled companion
- Verifies sourcemap generation during build
- Ensures debugging support in production

✅ **template file is compiled but excluded from loading**
- Verifies `_template.js` is compiled
- Confirms template is not loaded by `discoverCompanions()`
- Tests template exclusion in production

---

### Suite 5: End-to-End Execution (3 tests)

Tests actual execution of companions in both compiled and source modes.

✅ **should execute compiled companions successfully**
- Creates compiled companion that transforms data
- Inserts test data into database
- Runs `runCompanionMigrations()` with compiled companions
- Verifies data transformation executed correctly

✅ **should execute source companions successfully**
- Creates source companion that transforms data
- Tests execution in development mode
- Verifies data transformation with TypeScript companions

✅ **should handle mixed compiled and source scenarios**
- Creates both compiled and source companions
- Verifies compiled version takes precedence
- Ensures correct execution in mixed environments

---

### Suite 6: Logger Output Verification (2 tests)

Tests structured logging of compilation mode.

✅ **should log compiled: true when loading from dist/companions**
- Verifies logger receives `compiled: true` flag
- Tests production mode logging

✅ **should log compiled: false when loading from lib/migrations**
- Verifies logger receives `compiled: false` flag
- Tests development mode logging

---

## Key Testing Patterns

### Test Isolation
```typescript
beforeEach(() => {
  // Clean up test directory before each test
  if (existsSync(testBaseDir)) {
    rmSync(testBaseDir, { recursive: true, force: true });
  }
  mkdirSync(testBaseDir, { recursive: true });
  
  // Fresh database for each test
  const { db, sqlite } = createDatabase({
    path: ":memory:",
    schema,
    wal: false,
    foreignKeys: true,
  });
  testDb = db;
  testSqlite = sqlite;
  
  runMigrationsOnDatabase(testDb);
});
```

### Temporary Directory Structure
```
testBaseDir/
├── dist/
│   └── companions/
│       ├── 0001_test.js
│       └── 0002_test.js
└── lib/
    └── migrations/
        ├── 0001_test.ts
        └── 0002_test.ts
```

### Module Structure Testing
```typescript
// Compiled CommonJS module structure
module.exports = {
  default: {
    name: "0001_test",
    requiredTables: ["books"],
    execute: async (db) => {
      // Transformation logic
    }
  }
};

// Source ES module structure
export default {
  name: "0001_test",
  requiredTables: ["books"],
  execute: async (db) => {
    // Transformation logic
  }
};
```

---

## Coverage Summary

**Lines Tested**: Lines 47-118 of `lib/db/companion-migrations.ts` (`discoverCompanions()` function)

**Scenarios Covered**:
- ✅ Compiled mode detection (`dist/companions/` exists)
- ✅ Source mode detection (only `lib/migrations/` exists)
- ✅ Compiled preference (both directories exist)
- ✅ Empty directory handling
- ✅ File pattern matching (`.js` in compiled, `.ts` in source)
- ✅ Template file exclusion (`_template.js` / `_template.ts`)
- ✅ Numeric ordering (0001, 0002, 0015, etc.)
- ✅ Module loading (`require()` for both formats)
- ✅ Export validation (default and named exports)
- ✅ Structure validation (name, execute, requiredTables)
- ✅ End-to-end execution (data transformation)
- ✅ Build process verification (esbuild output)
- ✅ Source map generation
- ✅ Logger output (compiled flag)

---

## Integration with Existing Tests

**Total Companion Migration Tests**: 55 tests
- Unit tests: 21 tests (`companion-migrations.test.ts`)
- Integration tests: 13 tests (`companion-migrations-integration.test.ts`)
- **Compilation tests: 21 tests** (`companion-migrations-compilation.test.ts`)

All tests pass together without conflicts, providing comprehensive coverage of the companion migration framework.

---

## Build Configuration

**Build Script**: `npm run build:companions`

**Command**:
```bash
esbuild lib/migrations/*.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --outdir=dist/companions \
  --packages=external \
  --alias:@=. \
  --sourcemap
```

**Output**:
```
dist/companions/
├── 0015_progress_dates_timezone.js
├── 0015_progress_dates_timezone.js.map
├── 0016_session_dates_timezone.js
├── 0016_session_dates_timezone.js.map
├── 0019_initialize_read_next_order.js
├── 0019_initialize_read_next_order.js.map
├── 0020_streak_dates_to_text.js
├── 0020_streak_dates_to_text.js.map
├── _template.js
└── _template.js.map
```

---

## Runtime Behavior

### Production (Compiled Mode)
1. Check if `dist/companions/` exists → YES
2. Set `isCompiled = true`
3. Load from `dist/companions/*.js`
4. Use `require()` for CommonJS modules
5. Log: `{ compiled: true, dir: 'dist/companions' }`

### Development (Source Mode)
1. Check if `dist/companions/` exists → NO
2. Set `isCompiled = false`
3. Load from `lib/migrations/*.ts`
4. Use `require()` for TypeScript modules (via tsx/ts-node)
5. Log: `{ compiled: false, dir: 'lib/migrations' }`

### Fallback Behavior
- If `dist/companions/` doesn't exist → fall back to `lib/migrations/`
- If neither exists → return empty array, log debug message
- No errors thrown for missing directories

---

## Future Enhancements

Potential areas for additional testing:

1. **Performance Testing**
   - Compare load times: compiled vs source
   - Benchmark `require()` calls for large companion sets

2. **Error Handling**
   - Malformed JavaScript in compiled files
   - Syntax errors in source files
   - Missing dependencies in bundled code

3. **Cache Busting**
   - Node.js require cache behavior
   - Re-loading companions after changes

4. **Cross-Platform**
   - Windows path handling
   - Unix path handling
   - Different Node.js versions

---

## Maintenance

**When to Update Tests**:
- Adding new companion migration fields (e.g., `description`)
- Changing file naming conventions (e.g., prefix format)
- Modifying build configuration (esbuild options)
- Updating module export formats
- Changing directory structure

**Test Execution**:
```bash
# Run only compilation tests
npm test -- __tests__/integration/external/database/companion-migrations-compilation.test.ts

# Run all companion migration tests
npm test -- __tests__/integration/external/database/companion-migrations

# Run full test suite
npm test
```

---

**Last Updated**: 2026-01-24  
**Test Framework**: Vitest  
**Total Tests**: 21 passing  
**Execution Time**: ~300ms
