import { describe, it, expect, beforeAll, beforeEach, afterAll } from "bun:test";
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
});
