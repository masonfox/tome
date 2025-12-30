import { test, expect, describe } from "bun:test";
import { formatDateOnly } from '@/utils/dateHelpers';

describe("formatDateOnly", () => {
  test("should format ISO date string correctly regardless of timezone", () => {
    // Date stored as midnight UTC should display as Nov 23, 2025
    const isoString = "2025-11-23T00:00:00.000Z";
    const result = formatDateOnly(isoString);
    expect(result).toBe("Nov 23, 2025");
  });

  test("should format date with custom format string", () => {
    const isoString = "2025-11-23T00:00:00.000Z";
    const result = formatDateOnly(isoString, "yyyy-MM-dd");
    expect(result).toBe("2025-11-23");
  });

  test("should handle dates at different times of day consistently", () => {
    // These should all display as Nov 23, 2025
    const midnight = "2025-11-23T00:00:00.000Z";
    const noon = "2025-11-23T12:00:00.000Z";
    const evening = "2025-11-23T23:59:59.000Z";

    expect(formatDateOnly(midnight)).toBe("Nov 23, 2025");
    expect(formatDateOnly(noon)).toBe("Nov 23, 2025");
    expect(formatDateOnly(evening)).toBe("Nov 23, 2025");
  });

  test("should extract date part correctly from ISO string", () => {
    const isoString = "2024-01-15T08:30:45.123Z";
    const result = formatDateOnly(isoString);
    expect(result).toBe("Jan 15, 2024");
  });

  test("should work with different date formats", () => {
    const isoString = "2025-11-23T00:00:00.000Z";
    
    expect(formatDateOnly(isoString, "MMM d, yyyy")).toBe("Nov 23, 2025");
    expect(formatDateOnly(isoString, "MMMM d, yyyy")).toBe("November 23, 2025");
    expect(formatDateOnly(isoString, "MM/dd/yyyy")).toBe("11/23/2025");
    expect(formatDateOnly(isoString, "yyyy-MM-dd")).toBe("2025-11-23");
  });
});
