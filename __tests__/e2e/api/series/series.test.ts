import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { toSessionDate } from '../../../test-utils';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../../../helpers/db-setup";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { seriesService } from "@/lib/services/series.service";
import { GET as getSeriesList } from "@/app/api/series/route";
import { GET as getSeriesDetail } from "@/app/api/series/[name]/route";

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

// ============================================================================
// GET /api/series TESTS
// ============================================================================

describe("GET /api/series", () => {
  describe("Basic Functionality", () => {
    test("should return all series with book counts", async () => {
      // Arrange: Create books in multiple series
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Foundation",
        authors: ["Isaac Asimov"],
        tags: [],
        series: "Foundation Series",
        seriesIndex: 1,
        totalPages: 255,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/Book2 (2)",
        title: "Foundation and Empire",
        authors: ["Isaac Asimov"],
        tags: [],
        series: "Foundation Series",
        seriesIndex: 2,
        totalPages: 282,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "Author/Book3 (3)",
        title: "Dune",
        authors: ["Frank Herbert"],
        tags: [],
        series: "Dune Chronicles",
        seriesIndex: 1,
        totalPages: 688,
      });

      // Act
      const response = await getSeriesList();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toBeInstanceOf(Array);
      expect(data).toHaveLength(2);
      
      // Verify Foundation Series
      const foundationSeries = data.find((s: any) => s.name === "Foundation Series");
      expect(foundationSeries).toBeDefined();
      expect(foundationSeries.bookCount).toBe(2);
      expect(foundationSeries.bookCoverIds).toBeInstanceOf(Array);
      expect(foundationSeries.bookCoverIds).toHaveLength(2);
      expect(foundationSeries.bookCoverIds).toEqual([1, 2]);

      // Verify Dune Chronicles
      const duneSeries = data.find((s: any) => s.name === "Dune Chronicles");
      expect(duneSeries).toBeDefined();
      expect(duneSeries.bookCount).toBe(1);
      expect(duneSeries.bookCoverIds).toHaveLength(1);
      expect(duneSeries.bookCoverIds).toEqual([3]);
    });

    test("should return empty array when no series exist", async () => {
      // Arrange: Create books without series
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Standalone Book",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
      });

      // Act
      const response = await getSeriesList();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toBeInstanceOf(Array);
      expect(data).toHaveLength(0);
    });

    test("should sort series alphabetically by name", async () => {
      // Arrange: Create series in non-alphabetical order
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book Z",
        authors: ["Author 1"],
        tags: [],
        series: "Zebra Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/Book2 (2)",
        title: "Book A",
        authors: ["Author 2"],
        tags: [],
        series: "Alpha Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "Author/Book3 (3)",
        title: "Book M",
        authors: ["Author 3"],
        tags: [],
        series: "Middle Series",
        seriesIndex: 1,
      });

      // Act
      const response = await getSeriesList();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toHaveLength(3);
      expect(data[0].name).toBe("Alpha Series");
      expect(data[1].name).toBe("Middle Series");
      expect(data[2].name).toBe("Zebra Series");
    });

    test("should limit bookCoverIds to first 3 books", async () => {
      // Arrange: Create series with 5 books
      for (let i = 1; i <= 5; i++) {
        await bookRepository.create({
          calibreId: i,
          path: `Author/Book${i} (${i})`,
          title: `Book ${i}`,
          authors: ["Author 1"],
          tags: [],
          series: "Long Series",
          seriesIndex: i,
        });
      }

      // Act
      const response = await getSeriesList();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].bookCount).toBe(5);
      expect(data[0].bookCoverIds).toHaveLength(5); // Now returns up to 12 covers
      expect(data[0].bookCoverIds).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("Orphaned Books", () => {
    test("should exclude orphaned books from series counts", async () => {
      // Arrange: Create series with mix of normal and orphaned books
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "Test Series",
        seriesIndex: 1,
        orphaned: false,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/Book2 (2)",
        title: "Book 2",
        authors: ["Author 1"],
        tags: [],
        series: "Test Series",
        seriesIndex: 2,
        orphaned: true,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "Author/Book3 (3)",
        title: "Book 3",
        authors: ["Author 1"],
        tags: [],
        series: "Test Series",
        seriesIndex: 3,
        orphaned: false,
      });

      // Act
      const response = await getSeriesList();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].bookCount).toBe(2); // Only non-orphaned books
      expect(data[0].bookCoverIds).toEqual([1, 3]); // Should not include calibreId 2
    });

    test("should not return series that only contain orphaned books", async () => {
      // Arrange: Create series with only orphaned books
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Orphaned Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "Orphaned Series",
        seriesIndex: 1,
        orphaned: true,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/Book2 (2)",
        title: "Orphaned Book 2",
        authors: ["Author 1"],
        tags: [],
        series: "Orphaned Series",
        seriesIndex: 2,
        orphaned: true,
      });

      // Act
      const response = await getSeriesList();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toHaveLength(0); // Series should not appear
    });
  });

  describe("Error Handling", () => {
    test("should return 500 on internal error", async () => {
      // Mock seriesService to throw an error
      const originalGetAllSeries = seriesService.getAllSeries;
      seriesService.getAllSeries = (() => {
        throw new Error("Database connection failed");
      }) as any;

      const response = await getSeriesList();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Failed to fetch series");

      // Restore original function
      seriesService.getAllSeries = originalGetAllSeries;
    });
  });
});

// ============================================================================
// GET /api/series/:name TESTS
// ============================================================================

describe("GET /api/series/:name", () => {
  describe("Basic Functionality", () => {
    test("should return series details with all books ordered by series index", async () => {
      // Arrange: Create books in non-sequential order
      await bookRepository.create({
        calibreId: 3,
        path: "Herbert/Dune3 (3)",
        title: "Children of Dune",
        authors: ["Frank Herbert"],
        tags: ["sci-fi", "classic"],
        series: "Dune Chronicles",
        seriesIndex: 3,
        totalPages: 444,
        rating: 4,
        description: "Third book in the series",
      });

      await bookRepository.create({
        calibreId: 1,
        path: "Herbert/Dune1 (1)",
        title: "Dune",
        authors: ["Frank Herbert"],
        tags: ["sci-fi", "classic"],
        series: "Dune Chronicles",
        seriesIndex: 1,
        totalPages: 688,
        rating: 5,
        description: "First book in the series",
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Herbert/Dune2 (2)",
        title: "Dune Messiah",
        authors: ["Frank Herbert"],
        tags: ["sci-fi"],
        series: "Dune Chronicles",
        seriesIndex: 2,
        totalPages: 256,
        description: "Second book in the series",
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Dune%20Chronicles");
      const response = await getSeriesDetail(request, { params: { name: "Dune Chronicles" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.series).toBeDefined();
      expect(data.series.name).toBe("Dune Chronicles");
      expect(data.series.bookCount).toBe(3);
      expect(data.books).toBeInstanceOf(Array);
      expect(data.books).toHaveLength(3);

      // Verify ordering by series index
      expect(data.books[0].seriesIndex).toBe(1);
      expect(data.books[0].title).toBe("Dune");
      expect(data.books[0].calibreId).toBe(1);
      expect(data.books[0].authors).toEqual(["Frank Herbert"]);
      expect(data.books[0].totalPages).toBe(688);
      expect(data.books[0].rating).toBe(5);
      expect(data.books[0].tags).toEqual(["sci-fi", "classic"]);
      expect(data.books[0].description).toBe("First book in the series");

      expect(data.books[1].seriesIndex).toBe(2);
      expect(data.books[1].title).toBe("Dune Messiah");
      
      expect(data.books[2].seriesIndex).toBe(3);
      expect(data.books[2].title).toBe("Children of Dune");
    });

    test("should include book status from active reading sessions", async () => {
      // Arrange: Create series with different statuses
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1 - To Read",
        authors: ["Author 1"],
        tags: [],
        series: "Status Test Series",
        seriesIndex: 1,
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "Author/Book2 (2)",
        title: "Book 2 - Reading",
        authors: ["Author 1"],
        tags: [],
        series: "Status Test Series",
        seriesIndex: 2,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "Author/Book3 (3)",
        title: "Book 3 - No Status",
        authors: ["Author 1"],
        tags: [],
        series: "Status Test Series",
        seriesIndex: 3,
      });

      // Create sessions
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: toSessionDate(new Date()),
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Status%20Test%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Status Test Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(3);
      expect(data.books[0].status).toBe("to-read");
      expect(data.books[1].status).toBe("reading");
      expect(data.books[2].status).toBeNull(); // No active session
    });

    test("should handle fractional series indexes", async () => {
      // Arrange: Create books with fractional indexes (e.g., novellas between main books)
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "Fractional Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/Book1.5 (2)",
        title: "Book 1.5 - Novella",
        authors: ["Author 1"],
        tags: [],
        series: "Fractional Series",
        seriesIndex: 1.5,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "Author/Book2 (3)",
        title: "Book 2",
        authors: ["Author 1"],
        tags: [],
        series: "Fractional Series",
        seriesIndex: 2,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Fractional%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Fractional Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(3);
      expect(data.books[0].seriesIndex).toBe(1);
      expect(data.books[1].seriesIndex).toBe(1.5);
      expect(data.books[2].seriesIndex).toBe(2);
    });

    test("should handle multiple authors", async () => {
      // Arrange: Create book with multiple authors
      await bookRepository.create({
        calibreId: 1,
        path: "Authors/Book1 (1)",
        title: "Collaborative Book",
        authors: ["Author A", "Author B", "Author C"],
        tags: [],
        series: "Collaboration Series",
        seriesIndex: 1,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Collaboration%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Collaboration Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].authors).toBeInstanceOf(Array);
      expect(data.books[0].authors).toHaveLength(3);
      expect(data.books[0].authors).toEqual(["Author A", "Author B", "Author C"]);
    });
  });

  describe("URL Encoding", () => {
    test("should handle URL-encoded series names with spaces", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "Series With Spaces",
        seriesIndex: 1,
      });

      // Act - URL encoded: "Series With Spaces" -> "Series%20With%20Spaces"
      const request = new Request("http://localhost:3000/api/series/Series%20With%20Spaces");
      const response = await getSeriesDetail(request, { params: { name: "Series%20With%20Spaces" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.series.name).toBe("Series With Spaces");
      expect(data.books).toHaveLength(1);
    });

    test("should handle special characters in series names", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "Harry Potter & the Philosopher's Stone",
        seriesIndex: 1,
      });

      // Act - URL encoded special characters
      const encodedName = encodeURIComponent("Harry Potter & the Philosopher's Stone");
      const request = new Request(`http://localhost:3000/api/series/${encodedName}`);
      const response = await getSeriesDetail(request, { params: { name: encodedName } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.series.name).toBe("Harry Potter & the Philosopher's Stone");
      expect(data.books).toHaveLength(1);
    });

    test("should handle series names with colons", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "Series: The Beginning",
        seriesIndex: 1,
      });

      // Act
      const encodedName = encodeURIComponent("Series: The Beginning");
      const request = new Request(`http://localhost:3000/api/series/${encodedName}`);
      const response = await getSeriesDetail(request, { params: { name: encodedName } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.series.name).toBe("Series: The Beginning");
    });
  });

  describe("Orphaned Books", () => {
    test("should exclude orphaned books from series books list", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "Test Series",
        seriesIndex: 1,
        orphaned: false,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/Book2 (2)",
        title: "Book 2 - Orphaned",
        authors: ["Author 1"],
        tags: [],
        series: "Test Series",
        seriesIndex: 2,
        orphaned: true,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "Author/Book3 (3)",
        title: "Book 3",
        authors: ["Author 1"],
        tags: [],
        series: "Test Series",
        seriesIndex: 3,
        orphaned: false,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Test%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Test Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.series.bookCount).toBe(2); // Should exclude orphaned book
      expect(data.books).toHaveLength(2);
      expect(data.books[0].title).toBe("Book 1");
      expect(data.books[1].title).toBe("Book 3");
      // Book 2 should not be in the list
      expect(data.books.find((b: any) => b.title === "Book 2 - Orphaned")).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    test("should return 404 when series doesn't exist", async () => {
      // Arrange: Create some books but not in the requested series
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "Different Series",
        seriesIndex: 1,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Non-Existent%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Non-Existent Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe("Series not found");
    });

    test("should return 404 for empty database", async () => {
      // Act
      const request = new Request("http://localhost:3000/api/series/Any%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Any Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe("Series not found");
    });

    test("should return 500 on internal error", async () => {
      // Mock seriesService to throw an error
      const originalGetSeriesByName = seriesService.getSeriesByName;
      seriesService.getSeriesByName = (() => {
        throw new Error("Database connection failed");
      }) as any;

      const request = new Request("http://localhost:3000/api/series/Test");
      const response = await getSeriesDetail(request, { params: { name: "Test" } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Failed to fetch series books");

      // Restore original function
      seriesService.getSeriesByName = originalGetSeriesByName;
    });
  });

  describe("Edge Cases", () => {
    test("should handle series with null seriesIndex", async () => {
      // Arrange: Books with null seriesIndex should be treated as 0
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book with Index",
        authors: ["Author 1"],
        tags: [],
        series: "Edge Case Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/Book2 (2)",
        title: "Book without Index",
        authors: ["Author 1"],
        tags: [],
        series: "Edge Case Series",
        seriesIndex: null,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Edge%20Case%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Edge Case Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(2);
      // Null indexes are treated as 0 and sorted first
      expect(data.books[0].seriesIndex).toBe(0);
      expect(data.books[0].title).toBe("Book without Index");
      expect(data.books[1].seriesIndex).toBe(1);
      expect(data.books[1].title).toBe("Book with Index");
    });

    test("should handle duplicate series indexes with secondary sort by title", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/BookB (1)",
        title: "Book B",
        authors: ["Author 1"],
        tags: [],
        series: "Duplicate Index Series",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/BookA (2)",
        title: "Book A",
        authors: ["Author 1"],
        tags: [],
        series: "Duplicate Index Series",
        seriesIndex: 1,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Duplicate%20Index%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Duplicate Index Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(2);
      expect(data.books[0].seriesIndex).toBe(1);
      expect(data.books[0].title).toBe("Book A"); // Alphabetically first
      expect(data.books[1].seriesIndex).toBe(1);
      expect(data.books[1].title).toBe("Book B");
    });

    test("should handle case-sensitive series names", async () => {
      // Arrange: Create series with different cases
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: "The Foundation",
        seriesIndex: 1,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "Author/Book2 (2)",
        title: "Book 2",
        authors: ["Author 1"],
        tags: [],
        series: "the foundation",
        seriesIndex: 1,
      });

      // Act: Request "The Foundation" (capital T)
      const request1 = new Request("http://localhost:3000/api/series/The%20Foundation");
      const response1 = await getSeriesDetail(request1, { params: { name: "The Foundation" } });
      const data1 = await response1.json();

      // Assert: Should return only books with exact case match
      expect(response1.status).toBe(200);
      expect(data1.books).toHaveLength(1);
      expect(data1.books[0].title).toBe("Book 1");

      // Act: Request "the foundation" (lowercase t)
      const request2 = new Request("http://localhost:3000/api/series/the%20foundation");
      const response2 = await getSeriesDetail(request2, { params: { name: "the foundation" } });
      const data2 = await response2.json();

      // Assert: Should return only books with exact case match
      expect(response2.status).toBe(200);
      expect(data2.books).toHaveLength(1);
      expect(data2.books[0].title).toBe("Book 2");
    });

    test("should handle books with no totalPages", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book without Pages",
        authors: ["Author 1"],
        tags: [],
        series: "Pages Test Series",
        seriesIndex: 1,
        totalPages: undefined,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Pages%20Test%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Pages Test Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books[0].totalPages).toBeUndefined();
    });

    test("should handle books with no rating", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Unrated Book",
        authors: ["Author 1"],
        tags: [],
        series: "Rating Test Series",
        seriesIndex: 1,
        rating: null,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Rating%20Test%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Rating Test Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books[0].rating).toBeNull();
    });

    test("should handle books with empty tags array", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book with no tags",
        authors: ["Author 1"],
        tags: [],
        series: "Tags Test Series",
        seriesIndex: 1,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Tags%20Test%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Tags Test Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books[0].tags).toBeInstanceOf(Array);
      expect(data.books[0].tags).toHaveLength(0);
    });

    test("should handle series with single book", async () => {
      // Arrange
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Only Book",
        authors: ["Author 1"],
        tags: [],
        series: "Single Book Series",
        seriesIndex: 1,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Single%20Book%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Single Book Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.series.bookCount).toBe(1);
      expect(data.books).toHaveLength(1);
    });

    test("should handle very long series names", async () => {
      // Arrange
      const longName = "A".repeat(500);
      await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Book 1",
        authors: ["Author 1"],
        tags: [],
        series: longName,
        seriesIndex: 1,
      });

      // Act
      const encodedName = encodeURIComponent(longName);
      const request = new Request(`http://localhost:3000/api/series/${encodedName}`);
      const response = await getSeriesDetail(request, { params: { name: encodedName } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.series.name).toBe(longName);
    });
  });

  describe("Data Completeness", () => {
    test("should include all required book fields in response", async () => {
      // Arrange: Create a book with all fields populated
      const book = await bookRepository.create({
        calibreId: 1,
        path: "Author/Book1 (1)",
        title: "Complete Book",
        authors: ["Author 1", "Author 2"],
        tags: ["fiction", "adventure"],
        series: "Complete Series",
        seriesIndex: 1,
        totalPages: 350,
        rating: 4,
        description: "This is a test description",
      });

      // Create active session
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Act
      const request = new Request("http://localhost:3000/api/series/Complete%20Series");
      const response = await getSeriesDetail(request, { params: { name: "Complete Series" } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      const returnedBook = data.books[0];
      
      // Verify all required fields are present
      expect(returnedBook).toHaveProperty("id");
      expect(returnedBook).toHaveProperty("calibreId");
      expect(returnedBook).toHaveProperty("title");
      expect(returnedBook).toHaveProperty("authors");
      expect(returnedBook).toHaveProperty("seriesIndex");
      expect(returnedBook).toHaveProperty("totalPages");
      expect(returnedBook).toHaveProperty("rating");
      expect(returnedBook).toHaveProperty("status");
      expect(returnedBook).toHaveProperty("tags");
      expect(returnedBook).toHaveProperty("description");

      // Verify field values
      expect(returnedBook.calibreId).toBe(1);
      expect(returnedBook.title).toBe("Complete Book");
      expect(returnedBook.authors).toEqual(["Author 1", "Author 2"]);
      expect(returnedBook.seriesIndex).toBe(1);
      expect(returnedBook.totalPages).toBe(350);
      expect(returnedBook.rating).toBe(4);
      expect(returnedBook.status).toBe("reading");
      expect(returnedBook.tags).toEqual(["fiction", "adventure"]);
      expect(returnedBook.description).toBe("This is a test description");
    });
  });
});
