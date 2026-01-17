import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { seriesRepository } from "@/lib/repositories/series.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("SeriesRepository", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("getAllSeries", () => {
    it("should return all unique series with book counts", async () => {
      // Create books with series
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
        series: "Series A",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 1"],
        tags: [],
        path: "/path/2",
        series: "Series A",
        seriesIndex: 2,
      });

      await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 2"],
        tags: [],
        path: "/path/3",
        series: "Series B",
        seriesIndex: 1,
      });

      // Create book without series
      await bookRepository.create({
        calibreId: 4,
        title: "Book 4",
        authors: ["Author 3"],
        tags: [],
        path: "/path/4",
      });

      const series = await seriesRepository.getAllSeries();

      expect(series).toHaveLength(2);
      expect(series[0].name).toBe("Series A");
      expect(series[0].bookCount).toBe(2);
      expect(series[1].name).toBe("Series B");
      expect(series[1].bookCount).toBe(1);
    });

    it("should exclude orphaned books from series counts", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
        series: "Series A",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 1"],
        tags: [],
        path: "/path/2",
        series: "Series A",
        seriesIndex: 2,
        orphaned: true,
      });

      const series = await seriesRepository.getAllSeries();

      expect(series).toHaveLength(1);
      expect(series[0].bookCount).toBe(1);
    });

    it("should return empty array when no series exist", async () => {
      const series = await seriesRepository.getAllSeries();
      expect(series).toHaveLength(0);
    });

    it("should exclude books with empty string series", async () => {
      // Create books with valid series
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
        series: "Series A",
        seriesIndex: 1,
      });

      // Create book with empty string series (as Calibre might export)
      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 2"],
        tags: [],
        path: "/path/2",
        series: "",
        seriesIndex: null,
      });

      const series = await seriesRepository.getAllSeries();

      // Should only return Series A, not the empty string
      expect(series).toHaveLength(1);
      expect(series[0].name).toBe("Series A");
      expect(series[0].bookCount).toBe(1);
    });
  });

  describe("getBooksBySeries", () => {
    it("should return books in a series ordered by series index", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 3 of Series",
        authors: ["Author 1"],
        tags: ["tag1"],
        path: "/path/1",
        series: "Test Series",
        seriesIndex: 3,
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 1 of Series",
        authors: ["Author 1"],
        tags: [],
        path: "/path/2",
        series: "Test Series",
        seriesIndex: 1,
        totalPages: 200,
      });

      await bookRepository.create({
        calibreId: 3,
        title: "Book 2 of Series",
        authors: ["Author 1"],
        tags: [],
        path: "/path/3",
        series: "Test Series",
        seriesIndex: 2,
      });

      const books = await seriesRepository.getBooksBySeries("Test Series");

      expect(books).toHaveLength(3);
      expect(books[0].seriesIndex).toBe(1);
      expect(books[0].title).toBe("Book 1 of Series");
      expect(books[1].seriesIndex).toBe(2);
      expect(books[2].seriesIndex).toBe(3);
    });

    it("should include active session status", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
        series: "Test Series",
        seriesIndex: 1,
      });

      await sessionRepository.create({
        bookId: book.id,
        status: "reading",
        sessionNumber: 1,
        isActive: true,
      });

      const books = await seriesRepository.getBooksBySeries("Test Series");

      expect(books).toHaveLength(1);
      expect(books[0].status).toBe("reading");
    });

    it("should return empty array for non-existent series", async () => {
      const books = await seriesRepository.getBooksBySeries("Non-existent Series");
      expect(books).toHaveLength(0);
    });

    it("should exclude orphaned books", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
        series: "Test Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 1"],
        tags: [],
        path: "/path/2",
        series: "Test Series",
        seriesIndex: 2,
        orphaned: true,
      });

      const books = await seriesRepository.getBooksBySeries("Test Series");

      expect(books).toHaveLength(1);
      expect(books[0].title).toBe("Book 1");
    });
  });

  describe("getSeriesByName", () => {
    it("should return series info by name", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
        series: "Test Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 1"],
        tags: [],
        path: "/path/2",
        series: "Test Series",
        seriesIndex: 2,
      });

      const series = await seriesRepository.getSeriesByName("Test Series");

      expect(series).not.toBeNull();
      expect(series?.name).toBe("Test Series");
      expect(series?.bookCount).toBe(2);
    });

    it("should return null for non-existent series", async () => {
      const series = await seriesRepository.getSeriesByName("Non-existent");
      expect(series).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle series names with special characters", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        path: "/path/1",
        series: "Harry Potter & the Philosopher's Stone",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author 1"],
        tags: [],
        path: "/path/2",
        series: 'Series with "Quotes"',
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 3,
        title: "Book 3",
        authors: ["Author 1"],
        tags: [],
        path: "/path/3",
        series: "Series: With Colon",
        seriesIndex: 1,
      });

      const series = await seriesRepository.getAllSeries();
      expect(series).toHaveLength(3);

      const harryPotter = await seriesRepository.getBooksBySeries("Harry Potter & the Philosopher's Stone");
      expect(harryPotter).toHaveLength(1);
      expect(harryPotter[0].title).toBe("Book 1");

      const withQuotes = await seriesRepository.getBooksBySeries('Series with "Quotes"');
      expect(withQuotes).toHaveLength(1);
      expect(withQuotes[0].title).toBe("Book 2");

      const withColon = await seriesRepository.getBooksBySeries("Series: With Colon");
      expect(withColon).toHaveLength(1);
      expect(withColon[0].title).toBe("Book 3");
    });

    it("should handle fractional series indexes", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
        series: "Test Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 1.5",
        authors: ["Author"],
        tags: [],
        path: "/path/2",
        series: "Test Series",
        seriesIndex: 1.5,
      });

      await bookRepository.create({
        calibreId: 3,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
        path: "/path/3",
        series: "Test Series",
        seriesIndex: 2,
      });

      const books = await seriesRepository.getBooksBySeries("Test Series");
      expect(books).toHaveLength(3);
      expect(books[0].seriesIndex).toBe(1);
      expect(books[0].title).toBe("Book 1");
      expect(books[1].seriesIndex).toBe(1.5);
      expect(books[1].title).toBe("Book 1.5");
      expect(books[2].seriesIndex).toBe(2);
      expect(books[2].title).toBe("Book 2");
    });

    it("should handle NULL series indexes", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book with Index",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
        series: "Test Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book without Index",
        authors: ["Author"],
        tags: [],
        path: "/path/2",
        series: "Test Series",
        seriesIndex: null,
      });

      const books = await seriesRepository.getBooksBySeries("Test Series");
      expect(books).toHaveLength(2);
      
      // NULL indexes should be treated as 0 and sorted first
      expect(books[0].seriesIndex).toBe(0);
      expect(books[0].title).toBe("Book without Index");
      expect(books[1].seriesIndex).toBe(1);
      expect(books[1].title).toBe("Book with Index");
    });

    it("should handle duplicate series indexes with secondary sort by title", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book B",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
        series: "Test Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book A",
        authors: ["Author"],
        tags: [],
        path: "/path/2",
        series: "Test Series",
        seriesIndex: 1,
      });

      const books = await seriesRepository.getBooksBySeries("Test Series");
      expect(books).toHaveLength(2);
      expect(books[0].seriesIndex).toBe(1);
      expect(books[0].title).toBe("Book A");
      expect(books[1].seriesIndex).toBe(1);
      expect(books[1].title).toBe("Book B");
    });

    it("should handle case-sensitive series names", async () => {
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
        series: "The Foundation",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        title: "Book 2",
        authors: ["Author"],
        tags: [],
        path: "/path/2",
        series: "the foundation",
        seriesIndex: 1,
      });

      const series = await seriesRepository.getAllSeries();
      expect(series).toHaveLength(2);

      const upperBooks = await seriesRepository.getBooksBySeries("The Foundation");
      expect(upperBooks).toHaveLength(1);
      expect(upperBooks[0].title).toBe("Book 1");

      const lowerBooks = await seriesRepository.getBooksBySeries("the foundation");
      expect(lowerBooks).toHaveLength(1);
      expect(lowerBooks[0].title).toBe("Book 2");
    });

    it("should handle very long series names", async () => {
      const longName = "A".repeat(500);
      
      await bookRepository.create({
        calibreId: 1,
        title: "Book 1",
        authors: ["Author"],
        tags: [],
        path: "/path/1",
        series: longName,
        seriesIndex: 1,
      });

      const books = await seriesRepository.getBooksBySeries(longName);
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe("Book 1");
    });
  });
});
