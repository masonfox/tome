import { describe, it, expect } from "vitest";
import { getCoverUrl } from "@/lib/utils/cover-url";

describe("getCoverUrl", () => {
  describe("basic functionality", () => {
    it("should return base URL when no lastSynced provided", () => {
      const url = getCoverUrl(123);
      expect(url).toBe("/api/books/123/cover");
    });

    it("should return base URL when lastSynced is null", () => {
      const url = getCoverUrl(123, null);
      expect(url).toBe("/api/books/123/cover");
    });

    it("should return base URL when lastSynced is undefined", () => {
      const url = getCoverUrl(123, undefined);
      expect(url).toBe("/api/books/123/cover");
    });

    it("should include calibreId in URL", () => {
      const url = getCoverUrl(456);
      expect(url).toContain("456");
      expect(url).toBe("/api/books/456/cover");
    });
  });

  describe("timestamp handling", () => {
    it("should append timestamp when Date object provided", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const url = getCoverUrl(123, date);
      
      expect(url).toContain("/api/books/123/cover?t=");
      expect(url).toBe(`/api/books/123/cover?t=${date.getTime()}`);
    });

    it("should append timestamp when string date provided", () => {
      const dateString = "2024-01-15T10:30:00.000Z";
      const expectedTimestamp = new Date(dateString).getTime();
      const url = getCoverUrl(123, dateString);
      
      expect(url).toContain("/api/books/123/cover?t=");
      expect(url).toBe(`/api/books/123/cover?t=${expectedTimestamp}`);
    });

    it("should use milliseconds timestamp format", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const url = getCoverUrl(123, date);
      
      const timestamp = url.split("?t=")[1];
      expect(timestamp).toBe(date.getTime().toString());
      expect(timestamp.length).toBeGreaterThan(10); // Milliseconds have more digits than seconds
    });

    it("should handle different Date objects differently", () => {
      const date1 = new Date("2024-01-15T10:30:00.000Z");
      const date2 = new Date("2024-01-16T10:30:00.000Z");
      
      const url1 = getCoverUrl(123, date1);
      const url2 = getCoverUrl(123, date2);
      
      expect(url1).not.toBe(url2);
    });
  });

  describe("edge cases", () => {
    it("should handle calibreId of 0", () => {
      const url = getCoverUrl(0);
      expect(url).toBe("/api/books/0/cover");
    });

    it("should handle very large calibreIds", () => {
      const url = getCoverUrl(999999999);
      expect(url).toBe("/api/books/999999999/cover");
    });

    it("should handle invalid date strings gracefully", () => {
      const url = getCoverUrl(123, "invalid-date");
      // Invalid dates should fall back to base URL (no NaN in URL)
      expect(url).toBe("/api/books/123/cover");
      expect(url).not.toContain("NaN");
    });

    it("should handle epoch time (timestamp 0)", () => {
      const date = new Date(0);
      const url = getCoverUrl(123, date);
      expect(url).toBe("/api/books/123/cover?t=0");
    });
  });

  describe("URL format validation", () => {
    it("should use query parameter format with ?t=", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const url = getCoverUrl(123, date);
      
      expect(url).toMatch(/\/api\/books\/\d+\/cover\?t=\d+/);
    });

    it("should not add extra characters or encoding", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const url = getCoverUrl(123, date);
      
      expect(url).not.toContain("%");
      expect(url).not.toContain("&");
      expect(url).not.toContain("#");
    });

    it("should maintain consistent format across calls", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      
      const url1 = getCoverUrl(123, date);
      const url2 = getCoverUrl(123, date);
      
      expect(url1).toBe(url2);
    });
  });

  describe("practical usage scenarios", () => {
    it("should generate different URLs before and after sync", () => {
      const beforeSync = new Date("2024-01-15T10:00:00.000Z");
      const afterSync = new Date("2024-01-15T10:30:00.000Z");
      
      const urlBefore = getCoverUrl(123, beforeSync);
      const urlAfter = getCoverUrl(123, afterSync);
      
      expect(urlBefore).not.toBe(urlAfter);
      expect(urlBefore).toContain("?t=");
      expect(urlAfter).toContain("?t=");
    });

    it("should work with recently created Date objects", () => {
      const now = new Date();
      const url = getCoverUrl(123, now);
      
      expect(url).toContain("/api/books/123/cover?t=");
      expect(url).toContain(now.getTime().toString());
    });
  });
});
