/**
 * ADR-014 Date String Storage Compliance Tests
 * 
 * Validates that all calendar day dates (progress dates, session dates) are handled
 * as YYYY-MM-DD strings without conversion to Date objects in the frontend display layer.
 * 
 * Per ADR-014:
 * - Calendar dates are strings, not timestamps
 * - No timezone conversion should happen in display layer
 * - Date objects should only be used for comparison, not for display
 * 
 * Related: docs/ADRs/ADR-014-DATE-STRING-STORAGE.md
 */

import { describe, test, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

describe("ADR-014: Date String Storage Compliance", () => {
  const violationPatterns = [
    // Frontend violations: Converting YYYY-MM-DD strings to Date objects for display
    /new Date\(.*(?:startedDate|completedDate|progressDate|completedDate)\)/,
    /new Date\(entry\.progressDate\)/,
    /new Date\(.*session.*Date\)/,
  ];

  const allowedPatterns = [
    // Backend: Date comparisons and sorting are allowed
    /\.getTime\(\)/,
    /Date\.parse\(/,
    // Date validation utilities
    /date-validation\.ts/,
    /dateHelpers\.ts/,
    // Test files are allowed to test Date objects
    /__tests__\//,
    // Comments explaining the pattern
    /\/\//,
    /\/\*/,
  ];

  test("should not have Date conversion violations in frontend components", async () => {
    const componentFiles = await glob("components/**/*.{ts,tsx}", {
      cwd: path.resolve(__dirname, "../.."),
      absolute: true,
    });

    const violations: Array<{ file: string; line: number; content: string }> = [];

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Skip if this is a comment
        if (allowedPatterns.some((pattern) => pattern.test(line))) {
          return;
        }

        // Check for violations
        violationPatterns.forEach((pattern) => {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      });
    }

    if (violations.length > 0) {
      const message = [
        "ADR-014 violations found:",
        "Components should not convert YYYY-MM-DD strings to Date objects for display.",
        "",
        ...violations.map(
          (v) => `  ${v.file}:${v.line}\n    ${v.content}`
        ),
        "",
        "Per ADR-014, calendar dates should be used as strings directly.",
        "Use `formatDate(dateString)` helper if you need to format for display.",
      ].join("\n");

      expect.fail(message);
    }

    expect(violations).toHaveLength(0);
  });

  test("should use string types for calendar dates in interfaces", async () => {
    const interfaceFiles = await glob("components/Modals/*.tsx", {
      cwd: path.resolve(__dirname, "../.."),
      absolute: true,
    });

    const violations: Array<{ file: string; line: number; content: string }> = [];

    for (const file of interfaceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Look for interface properties that use Date type for calendar dates
        if (/(?:startedDate|completedDate|progressDate|completedDate|startDate|endDate).*:\s*Date/.test(line)) {
          // Exception: If there's a comment saying this is intentional, skip
          if (line.includes("// timestamp") || line.includes("// point in time")) {
            return;
          }

          violations.push({
            file: path.relative(process.cwd(), file),
            line: index + 1,
            content: line.trim(),
          });
        }
      });
    }

    if (violations.length > 0) {
      const message = [
        "ADR-014 violations found in interface definitions:",
        "Calendar date properties should use `string` type (YYYY-MM-DD), not `Date`.",
        "",
        ...violations.map(
          (v) => `  ${v.file}:${v.line}\n    ${v.content}`
        ),
        "",
        "Change to: `propertyName?: string; // YYYY-MM-DD format (ADR-014)`",
      ].join("\n");

      expect.fail(message);
    }

    expect(violations).toHaveLength(0);
  });

  test("should document the correct date string pattern", () => {
    // Verify that ADR-014 exists and contains the key principles
    const adrPath = path.resolve(__dirname, "../../docs/ADRs/ADR-014-DATE-STRING-STORAGE.md");
    
    expect(fs.existsSync(adrPath), "ADR-014 should exist").toBe(true);
    
    const adrContent = fs.readFileSync(adrPath, "utf-8");
    
    // Verify key principles are documented
    expect(adrContent).toContain("YYYY-MM-DD");
    expect(adrContent).toContain("calendar days");
    expect(adrContent).toContain("TEXT");
    expect(adrContent).toContain("timezone");
  });
});
