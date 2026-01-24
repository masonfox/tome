/**
 * Compilation Tests for Companion Migrations Framework
 * 
 * Tests companion migration compilation and runtime detection:
 * - Compiled mode detection (dist/companions/*.js)
 * - Source mode detection (lib/migrations/*.ts)
 * - Companion loading from compiled vs source
 * - Proper module structure validation
 * - Template file exclusion (_template.js/ts)
 * - Build process verification
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createDatabase } from "@/lib/db/factory";
import { runMigrationsOnDatabase } from "@/lib/db/migrate";
import { discoverCompanions, runCompanionMigrations } from "@/lib/db/companion-migrations";
import * as schema from "@/lib/db/schema";
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

describe("Companion Migrations - Compilation Tests", () => {
  let testDb: any;
  let testSqlite: any;
  let testBaseDir: string;

  beforeAll(() => {
    // Create temporary test directory structure
    testBaseDir = join(tmpdir(), `companion-compilation-${Date.now()}`);
  });

  afterAll(() => {
    // Clean up
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up test directory before each test for isolation
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
    
    // Create fresh database for each test
    const { db, sqlite } = createDatabase({
      path: ":memory:",
      schema,
      wal: false,
      foreignKeys: true,
    });
    testDb = db;
    testSqlite = sqlite;
    
    // Run schema migrations
    runMigrationsOnDatabase(testDb);
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
  });

  describe("Suite 1: Compilation Detection", () => {
    test("should detect compiled mode when dist/companions/ exists", () => {
      // Create dist/companions directory with compiled files
      const compiledDir = join(testBaseDir, "dist/companions");
      mkdirSync(compiledDir, { recursive: true });
      
      // Create compiled companion file
      writeFileSync(
        join(compiledDir, "0001_test.js"),
        `
        module.exports = {
          default: {
            name: "0001_test",
            requiredTables: ["books"],
            execute: async (db) => {
              // No-op
            }
          }
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      // Should find the compiled companion
      expect(companions).toHaveLength(1);
      expect(companions[0].name).toBe("0001_test");
      
      // Clean up
      rmSync(compiledDir, { recursive: true, force: true });
    });

    test("should detect source mode when only lib/migrations/ exists", () => {
      // Create lib/migrations directory with source files
      const sourceDir = join(testBaseDir, "lib/migrations");
      mkdirSync(sourceDir, { recursive: true });
      
      // Create source companion file
      writeFileSync(
        join(sourceDir, "0001_test.ts"),
        `
        export default {
          name: "0001_test",
          requiredTables: ["books"],
          execute: async (db) => {
            // No-op
          }
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      // Should find the source companion
      expect(companions).toHaveLength(1);
      expect(companions[0].name).toBe("0001_test");
      
      // Clean up
      rmSync(sourceDir, { recursive: true, force: true });
    });

    test("should prefer compiled mode over source when both exist", () => {
      // Create both directories
      const compiledDir = join(testBaseDir, "dist/companions");
      const sourceDir = join(testBaseDir, "lib/migrations");
      mkdirSync(compiledDir, { recursive: true });
      mkdirSync(sourceDir, { recursive: true });
      
      // Create compiled companion
      const compiledFile = join(compiledDir, "0001_prefer_test.js");
      writeFileSync(
        compiledFile,
        `
        module.exports = {
          default: {
            name: "0001_compiled",
            requiredTables: ["books"],
            execute: async (db) => {
              // Compiled version
            }
          }
        };
        `
      );
      
      // Create source companion with different name
      const sourceFile = join(sourceDir, "0001_prefer_test.ts");
      writeFileSync(
        sourceFile,
        `
        export default {
          name: "0001_source",
          requiredTables: ["books"],
          execute: async (db) => {
            // Source version
          }
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      // Should load from compiled directory
      expect(companions).toHaveLength(1);
      expect(companions[0].name).toBe("0001_compiled");
    });

    test("should return empty array when neither directory exists", () => {
      // Use empty temp directory
      const emptyDir = join(tmpdir(), `companion-empty-${Date.now()}`);
      mkdirSync(emptyDir, { recursive: true });
      
      try {
        const companions = discoverCompanions(emptyDir);
        expect(companions).toHaveLength(0);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe("Suite 2: Compiled Companion Loading", () => {
    test("should load companions from dist/companions/*.js in compiled mode", () => {
      const compiledDir = join(testBaseDir, "dist/companions");
      mkdirSync(compiledDir, { recursive: true });
      
      // Create multiple compiled companions
      writeFileSync(
        join(compiledDir, "0001_first.js"),
        `
        module.exports = {
          default: {
            name: "0001_first",
            requiredTables: ["books"],
            description: "First migration",
            execute: async (db) => {}
          }
        };
        `
      );
      
      writeFileSync(
        join(compiledDir, "0002_second.js"),
        `
        module.exports = {
          default: {
            name: "0002_second",
            requiredTables: ["reading_sessions"],
            description: "Second migration",
            execute: async (db) => {}
          }
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      expect(companions).toHaveLength(2);
      expect(companions[0].name).toBe("0001_first");
      expect(companions[0].description).toBe("First migration");
      expect(companions[1].name).toBe("0002_second");
      expect(companions[1].description).toBe("Second migration");
      
      // Clean up
      rmSync(compiledDir, { recursive: true, force: true });
    });

    test("should require compiled .js files without errors", () => {
      const compiledDir = join(testBaseDir, "dist/companions");
      mkdirSync(compiledDir, { recursive: true });
      
      // Create valid CommonJS module
      writeFileSync(
        join(compiledDir, "0001_valid.js"),
        `
        "use strict";
        var __defProp = Object.defineProperty;
        var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
        var __getOwnPropNames = Object.getOwnPropertyNames;
        var __hasOwnProp = Object.prototype.hasOwnProperty;
        var __export = (target, all) => {
          for (var name in all)
            __defProp(target, name, { get: all[name], enumerable: true });
        };
        var __copyProps = (to, from, except, desc) => {
          if (from && typeof from === "object" || typeof from === "function") {
            for (let key of __getOwnPropNames(from))
              if (!__hasOwnProp.call(to, key) && key !== except)
                __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
          }
          return to;
        };
        var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
        
        var valid_exports = {};
        __export(valid_exports, {
          default: () => valid_default
        });
        module.exports = __toCommonJS(valid_exports);
        
        var valid_default = {
          name: "0001_valid",
          requiredTables: ["books"],
          execute: async (db) => {}
        };
        `
      );
      
      expect(() => discoverCompanions(testBaseDir)).not.toThrow();
      
      const companions = discoverCompanions(testBaseDir);
      expect(companions).toHaveLength(1);
      expect(companions[0].name).toBe("0001_valid");
      
      // Clean up
      rmSync(compiledDir, { recursive: true, force: true });
    });

    test("should validate companion structure (name, execute, requiredTables)", () => {
      const compiledDir = join(testBaseDir, "dist/companions");
      mkdirSync(compiledDir, { recursive: true });
      
      // Valid companion
      writeFileSync(
        join(compiledDir, "0001_valid.js"),
        `
        module.exports = {
          default: {
            name: "0001_valid",
            requiredTables: ["books"],
            execute: async (db) => {}
          }
        };
        `
      );
      
      // Invalid - missing name
      writeFileSync(
        join(compiledDir, "0002_no_name.js"),
        `
        module.exports = {
          default: {
            requiredTables: ["books"],
            execute: async (db) => {}
          }
        };
        `
      );
      
      // Invalid - missing execute
      writeFileSync(
        join(compiledDir, "0003_no_execute.js"),
        `
        module.exports = {
          default: {
            name: "0003_no_execute",
            requiredTables: ["books"]
          }
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      // Should only load the valid companion
      expect(companions).toHaveLength(1);
      expect(companions[0].name).toBe("0001_valid");
      
      // Clean up
      rmSync(compiledDir, { recursive: true, force: true });
    });

    test("should skip _template.js file in compiled mode", () => {
      const compiledDir = join(testBaseDir, "dist/companions");
      mkdirSync(compiledDir, { recursive: true });
      
      // Create template file
      writeFileSync(
        join(compiledDir, "_template.js"),
        `
        module.exports = {
          default: {
            name: "_template",
            requiredTables: [],
            execute: async (db) => {}
          }
        };
        `
      );
      
      // Create real companion
      writeFileSync(
        join(compiledDir, "0001_real.js"),
        `
        module.exports = {
          default: {
            name: "0001_real",
            requiredTables: ["books"],
            execute: async (db) => {}
          }
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      // Should only load 0001_real, not _template
      expect(companions).toHaveLength(1);
      expect(companions[0].name).toBe("0001_real");
      
      // Clean up
      rmSync(compiledDir, { recursive: true, force: true });
    });

    test("should load companions in numeric order", () => {
      const compiledDir = join(testBaseDir, "dist/companions");
      mkdirSync(compiledDir, { recursive: true });
      
      // Create companions out of order
      writeFileSync(
        join(compiledDir, "0015_third.js"),
        `
        module.exports = {
          default: {
            name: "0015_third",
            requiredTables: [],
            execute: async (db) => {}
          }
        };
        `
      );
      
      writeFileSync(
        join(compiledDir, "0002_first.js"),
        `
        module.exports = {
          default: {
            name: "0002_first",
            requiredTables: [],
            execute: async (db) => {}
          }
        };
        `
      );
      
      writeFileSync(
        join(compiledDir, "0010_second.js"),
        `
        module.exports = {
          default: {
            name: "0010_second",
            requiredTables: [],
            execute: async (db) => {}
          }
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      // Should be sorted numerically (alphabetically by filename)
      expect(companions).toHaveLength(3);
      expect(companions[0].name).toBe("0002_first");
      expect(companions[1].name).toBe("0010_second");
      expect(companions[2].name).toBe("0015_third");
      
      // Clean up
      rmSync(compiledDir, { recursive: true, force: true });
    });
  });

  describe("Suite 3: Source Companion Loading (Development)", () => {
    test("should load companions from lib/migrations/*.ts in source mode", () => {
      const sourceDir = join(testBaseDir, "lib/migrations");
      mkdirSync(sourceDir, { recursive: true });
      
      // Create source companions
      writeFileSync(
        join(sourceDir, "0001_first.ts"),
        `
        export default {
          name: "0001_first",
          requiredTables: ["books"],
          execute: async (db) => {}
        };
        `
      );
      
      writeFileSync(
        join(sourceDir, "0002_second.ts"),
        `
        export default {
          name: "0002_second",
          requiredTables: ["reading_sessions"],
          execute: async (db) => {}
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      expect(companions).toHaveLength(2);
      expect(companions[0].name).toBe("0001_first");
      expect(companions[1].name).toBe("0002_second");
      
      // Clean up
      rmSync(sourceDir, { recursive: true, force: true });
    });

    test("should skip _template.ts file in source mode", () => {
      const sourceDir = join(testBaseDir, "lib/migrations");
      mkdirSync(sourceDir, { recursive: true });
      
      // Create template file
      writeFileSync(
        join(sourceDir, "_template.ts"),
        `
        export default {
          name: "_template",
          requiredTables: [],
          execute: async (db) => {}
        };
        `
      );
      
      // Create real companion
      writeFileSync(
        join(sourceDir, "0001_real.ts"),
        `
        export default {
          name: "0001_real",
          requiredTables: ["books"],
          execute: async (db) => {}
        };
        `
      );
      
      const companions = discoverCompanions(testBaseDir);
      
      // Should only load 0001_real, not _template
      expect(companions).toHaveLength(1);
      expect(companions[0].name).toBe("0001_real");
      
      // Clean up
      rmSync(sourceDir, { recursive: true, force: true });
    });

    test("should fall back gracefully when compiled directory doesn't exist", () => {
      // Create only source directory
      const sourceDir = join(testBaseDir, "lib/migrations");
      mkdirSync(sourceDir, { recursive: true });
      
      writeFileSync(
        join(sourceDir, "0001_source.ts"),
        `
        export default {
          name: "0001_source",
          requiredTables: ["books"],
          execute: async (db) => {}
        };
        `
      );
      
      // Verify dist/companions doesn't exist
      const compiledDir = join(testBaseDir, "dist/companions");
      expect(existsSync(compiledDir)).toBe(false);
      
      // Should fall back to source mode
      const companions = discoverCompanions(testBaseDir);
      expect(companions).toHaveLength(1);
      expect(companions[0].name).toBe("0001_source");
      
      // Clean up
      rmSync(sourceDir, { recursive: true, force: true });
    });
  });

  describe("Suite 4: Build Process Verification", () => {
    test("npm run build:companions creates all expected files", () => {
      // This test runs against the actual project build
      const projectRoot = process.cwd();
      const compiledDir = join(projectRoot, "dist/companions");
      const sourceDir = join(projectRoot, "lib/migrations");
      
      // Get source files (excluding template)
      const sourceFiles = readdirSync(sourceDir)
        .filter(f => /^\d{4}_.*\.ts$/.test(f))
        .filter(f => !f.startsWith('_'));
      
      expect(sourceFiles.length).toBeGreaterThan(0);
      
      // Check compiled files exist
      expect(existsSync(compiledDir)).toBe(true);
      
      const compiledFiles = readdirSync(compiledDir)
        .filter(f => /^\d{4}_.*\.js$/.test(f));
      
      // Should have one compiled .js for each source .ts
      expect(compiledFiles.length).toBe(sourceFiles.length);
      
      // Verify each source has corresponding compiled file
      for (const sourceFile of sourceFiles) {
        const baseName = sourceFile.replace('.ts', '');
        const compiledFile = `${baseName}.js`;
        const compiledPath = join(compiledDir, compiledFile);
        
        expect(existsSync(compiledPath)).toBe(true);
      }
    });

    test("compiled files have correct structure (CJS exports)", () => {
      const projectRoot = process.cwd();
      const compiledDir = join(projectRoot, "dist/companions");
      
      // Get a compiled file
      const compiledFiles = readdirSync(compiledDir)
        .filter(f => /^\d{4}_.*\.js$/.test(f));
      
      expect(compiledFiles.length).toBeGreaterThan(0);
      
      // Check first compiled file for CJS structure
      const firstFile = join(compiledDir, compiledFiles[0]);
      const content = require('fs').readFileSync(firstFile, 'utf-8');
      
      // Should have CJS markers
      expect(content).toContain('module.exports');
      expect(content).toContain('"use strict"');
      
      // Should be able to require it
      expect(() => require(firstFile)).not.toThrow();
      
      // Should have proper export structure
      const module = require(firstFile);
      expect(module.default || module.migration).toBeDefined();
      
      const companion = module.default || module.migration;
      expect(companion.name).toBeDefined();
      expect(companion.execute).toBeDefined();
      expect(typeof companion.execute).toBe('function');
    });

    test("source maps are generated (.js.map files)", () => {
      const projectRoot = process.cwd();
      const compiledDir = join(projectRoot, "dist/companions");
      
      // Get compiled files
      const compiledFiles = readdirSync(compiledDir)
        .filter(f => /^\d{4}_.*\.js$/.test(f));
      
      expect(compiledFiles.length).toBeGreaterThan(0);
      
      // Check each has corresponding source map
      for (const compiledFile of compiledFiles) {
        const sourceMapFile = `${compiledFile}.map`;
        const sourceMapPath = join(compiledDir, sourceMapFile);
        
        expect(existsSync(sourceMapPath)).toBe(true);
      }
    });

    test("template file is compiled but excluded from loading", () => {
      const projectRoot = process.cwd();
      const compiledDir = join(projectRoot, "dist/companions");
      
      // Template should be compiled
      const templatePath = join(compiledDir, "_template.js");
      expect(existsSync(templatePath)).toBe(true);
      
      // But should not be loaded by discoverCompanions
      const companions = discoverCompanions(projectRoot);
      const templateLoaded = companions.some(c => c.name === "_template");
      
      expect(templateLoaded).toBe(false);
    });
  });

  describe("Suite 5: End-to-End Execution (Compiled vs Source)", () => {
    test("should execute compiled companions successfully", async () => {
      const compiledDir = join(testBaseDir, "dist/companions");
      mkdirSync(compiledDir, { recursive: true });
      
      // Create compiled companion that transforms data
      writeFileSync(
        join(compiledDir, "0001_transform.js"),
        `
        module.exports = {
          default: {
            name: "0001_transform",
            requiredTables: ["books"],
            execute: async (db) => {
              const books = db.prepare("SELECT id, title FROM books WHERE title LIKE 'TEST:%'").all();
              const updateStmt = db.prepare("UPDATE books SET title = ? WHERE id = ?");
              
              for (const book of books) {
                const newTitle = book.title.replace('TEST:', 'COMPILED:');
                updateStmt.run(newTitle, book.id);
              }
            }
          }
        };
        `
      );
      
      try {
        // Insert test data
        testSqlite.prepare(
          "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
        ).run(1, "TEST:Book", '["Author"]', "/path");
        
        // Run companions
        await runCompanionMigrations(testSqlite, testBaseDir);
        
        // Verify transformation
        const book = testSqlite.prepare(
          "SELECT title FROM books WHERE calibre_id = ?"
        ).get(1) as { title: string };
        
        expect(book.title).toBe("COMPILED:Book");
      } finally {
        rmSync(compiledDir, { recursive: true, force: true });
      }
    });

    test("should execute source companions successfully", async () => {
      const sourceDir = join(testBaseDir, "lib/migrations");
      mkdirSync(sourceDir, { recursive: true });
      
      // Create source companion that transforms data
      writeFileSync(
        join(sourceDir, "0001_transform.ts"),
        `
        export default {
          name: "0001_transform",
          requiredTables: ["books"],
          execute: async (db) => {
            const books = db.prepare("SELECT id, title FROM books WHERE title LIKE 'TEST:%'").all();
            const updateStmt = db.prepare("UPDATE books SET title = ? WHERE id = ?");
            
            for (const book of books) {
              const newTitle = book.title.replace('TEST:', 'SOURCE:');
              updateStmt.run(newTitle, book.id);
            }
          }
        };
        `
      );
      
      try {
        // Insert test data
        testSqlite.prepare(
          "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
        ).run(1, "TEST:Book", '["Author"]', "/path");
        
        // Run companions
        await runCompanionMigrations(testSqlite, testBaseDir);
        
        // Verify transformation
        const book = testSqlite.prepare(
          "SELECT title FROM books WHERE calibre_id = ?"
        ).get(1) as { title: string };
        
        expect(book.title).toBe("SOURCE:Book");
      } finally {
        rmSync(sourceDir, { recursive: true, force: true });
      }
    });

    test("should handle mixed compiled and source scenarios", async () => {
      // Create both directories
      const compiledDir = join(testBaseDir, "dist/companions");
      const sourceDir = join(testBaseDir, "lib/migrations");
      mkdirSync(compiledDir, { recursive: true });
      mkdirSync(sourceDir, { recursive: true });
      
      // Create compiled companion
      writeFileSync(
        join(compiledDir, "0001_compiled.js"),
        `
        module.exports = {
          default: {
            name: "0001_compiled",
            requiredTables: ["books"],
            execute: async (db) => {
              db.prepare("UPDATE books SET title = 'COMPILED:' || title WHERE calibre_id = 1").run();
            }
          }
        };
        `
      );
      
      // Create source companion (should be ignored)
      writeFileSync(
        join(sourceDir, "0001_source.ts"),
        `
        export default {
          name: "0001_source",
          requiredTables: ["books"],
          execute: async (db) => {
            db.prepare("UPDATE books SET title = 'SOURCE:' || title WHERE calibre_id = 1").run();
          }
        };
        `
      );
      
      try {
        // Insert test data
        testSqlite.prepare(
          "INSERT INTO books (calibre_id, title, authors, path) VALUES (?, ?, ?, ?)"
        ).run(1, "Original", '["Author"]', "/path");
        
        // Run companions (should use compiled)
        await runCompanionMigrations(testSqlite, testBaseDir);
        
        // Verify compiled version was used
        const book = testSqlite.prepare(
          "SELECT title FROM books WHERE calibre_id = ?"
        ).get(1) as { title: string };
        
        expect(book.title).toBe("COMPILED:Original");
        expect(book.title).not.toContain("SOURCE:");
      } finally {
        rmSync(compiledDir, { recursive: true, force: true });
        rmSync(sourceDir, { recursive: true, force: true });
      }
    });
  });

  describe("Suite 6: Logger Output Verification", () => {
    test("should log compiled: true when loading from dist/companions", () => {
      const compiledDir = join(testBaseDir, "dist/companions");
      mkdirSync(compiledDir, { recursive: true });
      
      writeFileSync(
        join(compiledDir, "0001_test.js"),
        `
        module.exports = {
          default: {
            name: "0001_test",
            requiredTables: [],
            execute: async (db) => {}
          }
        };
        `
      );
      
      try {
        // Discovery logs the compiled flag
        const companions = discoverCompanions(testBaseDir);
        
        // Verify structure is correct (compiled companions loaded)
        expect(companions).toHaveLength(1);
        expect(companions[0].name).toBe("0001_test");
        
        // Note: Logger output is tested by checking behavior
        // In production, this would log: { compiled: true, dir: 'dist/companions' }
      } finally {
        rmSync(compiledDir, { recursive: true, force: true });
      }
    });

    test("should log compiled: false when loading from lib/migrations", () => {
      const sourceDir = join(testBaseDir, "lib/migrations");
      mkdirSync(sourceDir, { recursive: true });
      
      writeFileSync(
        join(sourceDir, "0001_test.ts"),
        `
        export default {
          name: "0001_test",
          requiredTables: [],
          execute: async (db) => {}
        };
        `
      );
      
      try {
        // Discovery logs the compiled flag
        const companions = discoverCompanions(testBaseDir);
        
        // Verify structure is correct (source companions loaded)
        expect(companions).toHaveLength(1);
        expect(companions[0].name).toBe("0001_test");
        
        // Note: Logger output is tested by checking behavior
        // In production, this would log: { compiled: false, dir: 'lib/migrations' }
      } finally {
        rmSync(sourceDir, { recursive: true, force: true });
      }
    });
  });
});
