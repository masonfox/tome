/**
 * Tests for progress calculation utilities
 * 
 * These utilities centralize percentage and page calculations to ensure
 * consistent rounding behavior (Math.floor) across the application.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePercentage,
  calculatePageFromPercentage,
  isBookComplete,
} from "@/lib/utils/progress-calculations";

describe("calculatePercentage", () => {
  it("calculates percentage for complete books", () => {
    expect(calculatePercentage(300, 300)).toBe(100);
    expect(calculatePercentage(500, 500)).toBe(100);
  });

  it("calculates percentage for books at exactly half", () => {
    expect(calculatePercentage(150, 300)).toBe(50);
    expect(calculatePercentage(250, 500)).toBe(50);
  });

  it("uses Math.floor to prevent premature completion", () => {
    // Critical: 299/300 = 99.666... should floor to 99%, NOT round to 100%
    expect(calculatePercentage(299, 300)).toBe(99);
    
    // More examples of flooring behavior
    expect(calculatePercentage(199, 200)).toBe(99); // 99.5% -> 99%
    expect(calculatePercentage(99, 100)).toBe(99);  // 99% -> 99%
  });

  it("floors non-integer percentages", () => {
    // 93/186 = 50.0376344... should floor to 50%
    expect(calculatePercentage(93, 186)).toBe(50);
    
    // 123/456 = 26.9736842... should floor to 26%
    expect(calculatePercentage(123, 456)).toBe(26);
    
    // 1/3 = 33.333... should floor to 33%
    expect(calculatePercentage(1, 3)).toBe(33);
  });

  it("handles zero and boundary values", () => {
    expect(calculatePercentage(0, 300)).toBe(0);
    expect(calculatePercentage(1, 300)).toBe(0); // 0.333% -> 0%
    expect(calculatePercentage(3, 300)).toBe(1); // 1% exactly
  });

  it("handles single page books", () => {
    expect(calculatePercentage(0, 1)).toBe(0);
    expect(calculatePercentage(1, 1)).toBe(100);
  });

  it("returns 0 for invalid total pages", () => {
    expect(calculatePercentage(50, 0)).toBe(0);
  });
});

describe("calculatePageFromPercentage", () => {
  it("calculates page from percentage for complete books", () => {
    expect(calculatePageFromPercentage(100, 300)).toBe(300);
    expect(calculatePageFromPercentage(100, 500)).toBe(500);
  });

  it("calculates page from percentage at half", () => {
    expect(calculatePageFromPercentage(50, 300)).toBe(150);
    expect(calculatePageFromPercentage(50, 500)).toBe(250);
  });

  it("uses Math.floor for consistency", () => {
    // 99% of 300 = 297, not 297.something
    expect(calculatePageFromPercentage(99, 300)).toBe(297);
    
    // 33% of 100 = 33, not 33.333...
    expect(calculatePageFromPercentage(33, 100)).toBe(33);
    
    // 66% of 300 = 198, not 198.666...
    expect(calculatePageFromPercentage(66, 300)).toBe(198);
  });

  it("handles zero and boundary values", () => {
    expect(calculatePageFromPercentage(0, 300)).toBe(0);
    expect(calculatePageFromPercentage(1, 300)).toBe(3); // 1% of 300 = 3
    expect(calculatePageFromPercentage(100, 1)).toBe(1);
  });

  it("returns 0 for invalid total pages", () => {
    expect(calculatePageFromPercentage(50, 0)).toBe(0);
  });

  it("clamps values above 100%", () => {
    // Percentages >= 100% should return totalPages (book is complete)
    expect(calculatePageFromPercentage(150, 300)).toBe(300);
    expect(calculatePageFromPercentage(100, 300)).toBe(300);
  });
});

describe("isBookComplete", () => {
  it("returns true when current page equals total pages", () => {
    expect(isBookComplete(300, 300)).toBe(true);
    expect(isBookComplete(1, 1)).toBe(true);
    expect(isBookComplete(500, 500)).toBe(true);
  });

  it("returns false when one page away from completion", () => {
    // Critical: 299/300 should NOT be considered complete
    expect(isBookComplete(299, 300)).toBe(false);
    expect(isBookComplete(99, 100)).toBe(false);
    expect(isBookComplete(499, 500)).toBe(false);
  });

  it("returns false for partially read books", () => {
    expect(isBookComplete(150, 300)).toBe(false);
    expect(isBookComplete(1, 300)).toBe(false);
    expect(isBookComplete(0, 300)).toBe(false);
  });

  it("returns true when current page exceeds total pages", () => {
    // Edge case: should handle gracefully
    expect(isBookComplete(301, 300)).toBe(true);
  });

  it("handles zero total pages", () => {
    expect(isBookComplete(0, 0)).toBe(true); // Technically complete
    expect(isBookComplete(1, 0)).toBe(true); // Invalid state, but handle it
  });
});

describe("Integration: Percentage <-> Page roundtrip", () => {
  it("maintains consistency in both directions", () => {
    const totalPages = 300;
    
    // Start with page 150
    const percentage = calculatePercentage(150, totalPages);
    expect(percentage).toBe(50);
    
    // Convert back to page
    const page = calculatePageFromPercentage(percentage, totalPages);
    expect(page).toBe(150);
  });

  it("handles flooring in roundtrip conversions", () => {
    const totalPages = 186;
    
    // Start with page 93 (50.0376...%)
    const percentage = calculatePercentage(93, totalPages);
    expect(percentage).toBe(50); // Floored from 50.0376...
    
    // Convert back to page: 50% of 186 = 93
    const page = calculatePageFromPercentage(percentage, totalPages);
    expect(page).toBe(93);
  });

  it("prevents false completion in roundtrip", () => {
    const totalPages = 300;
    
    // Start with page 299 (99.666...%)
    const percentage = calculatePercentage(299, totalPages);
    expect(percentage).toBe(99); // MUST be 99, not 100!
    
    // Verify not complete
    expect(isBookComplete(299, totalPages)).toBe(false);
    
    // Convert back: 99% of 300 = 297 (loses precision, but that's expected)
    const page = calculatePageFromPercentage(percentage, totalPages);
    expect(page).toBe(297);
  });
});

describe("Real-world scenario: Progress edit modal bug", () => {
  it("prevents non-integer percentages from appearing in database", () => {
    // Original bug: 93/186 pages = 50.0376344086022%
    const currentPage = 93;
    const totalPages = 186;
    
    const percentage = calculatePercentage(currentPage, totalPages);
    
    // Should be integer 50, not 50.0376344086022
    expect(percentage).toBe(50);
    expect(Number.isInteger(percentage)).toBe(true);
  });

  it("prevents 299/300 pages from triggering book completion", () => {
    // Critical bug: 299/300 with Math.round() = 100% = book auto-completes
    const currentPage = 299;
    const totalPages = 300;
    
    const percentage = calculatePercentage(currentPage, totalPages);
    
    // Should be 99%, NOT 100%
    expect(percentage).toBe(99);
    expect(isBookComplete(currentPage, totalPages)).toBe(false);
  });
});
