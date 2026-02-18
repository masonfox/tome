import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { seriesService, SeriesError } from "@/lib/services/series.service";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("SeriesService", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("getAllSeries", () => {
    it("should return empty array when no series exist", async () => {
      const series = await seriesService.getAllSeries();
      expect(series).toEqual([]);
    });

    it("should return all series with book counts", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        series: "Series A",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
        series: "Series B",
        seriesIndex: 1,
      });

      const series = await seriesService.getAllSeries();
      expect(series).toHaveLength(2);
      expect(series[0].name).toBe("Series A");
      expect(series[1].name).toBe("Series B");
    });
  });

  describe("getBooksBySeries", () => {
    it("should throw SeriesError for empty series name", async () => {
      try {
        await seriesService.getBooksBySeries("");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(SeriesError);
        expect((error as SeriesError).code).toBe('INVALID_INPUT');
      }
    });

    it("should throw SeriesError for whitespace-only series name", async () => {
      try {
        await seriesService.getBooksBySeries("   ");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(SeriesError);
        expect((error as SeriesError).code).toBe('INVALID_INPUT');
      }
    });

    it("should throw SeriesError for series name exceeding 500 characters", async () => {
      const longName = "A".repeat(501);
      try {
        await seriesService.getBooksBySeries(longName);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(SeriesError);
        expect((error as SeriesError).code).toBe('INVALID_INPUT');
      }
    });

    it("should trim series name before querying", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        series: "Test Series",
        seriesIndex: 1,
      });

      const books = await seriesService.getBooksBySeries("  Test Series  ");
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe("Book 1");
    });

    it("should return empty array for non-existent series", async () => {
      const books = await seriesService.getBooksBySeries("Non-existent");
      expect(books).toEqual([]);
    });

    it("should return books ordered by series index", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 3",
        authors: ["Author"],
        tags: [],
        series: "Test Series",
        seriesIndex: 3,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        series: "Test Series",
        seriesIndex: 1,
      });

      const books = await seriesService.getBooksBySeries("Test Series");
      expect(books).toHaveLength(2);
      expect(books[0].seriesIndex).toBe(1);
      expect(books[1].seriesIndex).toBe(3);
    });

    it("should handle series names with special characters", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        series: "Harry Potter & the Philosopher's Stone",
        seriesIndex: 1,
      });

      const books = await seriesService.getBooksBySeries("Harry Potter & the Philosopher's Stone");
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe("Book 1");
    });
  });

  describe("getSeriesByName", () => {
    it("should throw SeriesError for empty series name", async () => {
      try {
        await seriesService.getSeriesByName("");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(SeriesError);
        expect((error as SeriesError).code).toBe('INVALID_INPUT');
      }
    });

    it("should throw SeriesError for whitespace-only series name", async () => {
      try {
        await seriesService.getSeriesByName("   ");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(SeriesError);
        expect((error as SeriesError).code).toBe('INVALID_INPUT');
      }
    });

    it("should return null for non-existent series", async () => {
      const series = await seriesService.getSeriesByName("Non-existent");
      expect(series).toBeNull();
    });

    it("should return series info when found", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        series: "Test Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
        series: "Test Series",
        seriesIndex: 2,
      });

      const series = await seriesService.getSeriesByName("Test Series");
      expect(series).not.toBeNull();
      expect(series?.name).toBe("Test Series");
      expect(series?.bookCount).toBe(2);
    });

    it("should trim series name before querying", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        series: "Test Series",
        seriesIndex: 1,
      });

      const series = await seriesService.getSeriesByName("  Test Series  ");
      expect(series).not.toBeNull();
      expect(series?.name).toBe("Test Series");
    });
  });
});
