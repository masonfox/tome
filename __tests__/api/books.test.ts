import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../helpers/db-setup";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { GET, POST } from "@/app/api/books/route";
import { createMockRequest } from "../fixtures/test-data";

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearTestDatabase();
});

describe("GET /api/books", () => {
  // ============================================================================
  // STATUS FILTERING TESTS
  // ============================================================================

  describe("Status Filtering", () => {
    test("should filter books by 'to-read' status (active sessions)", async () => {
      // Arrange: Create books with different statuses
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "Author 1/To Read Book (1)",
        title: "To Read Book",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "Author 2/Reading Book (2)",
        title: "Reading Book",
        authors: ["Author 2"],
        tags: [],
        totalPages: 400,
      });

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
      });

      // Act
      const request = createMockRequest("GET", "/api/books?status=to-read");
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("To Read Book");
      expect(data.books[0].status).toBe("to-read");
      expect(data.total).toBe(1);
    });

    test("should filter books by 'read-next' status (active sessions)", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Read Next Book",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "To Read Book",
        authors: ["Author 2"],
        tags: [],
        totalPages: 400,
      });

      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read-next",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      const request = createMockRequest("GET", "/api/books?status=read-next");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Read Next Book");
      expect(data.books[0].status).toBe("read-next");
    });

    test("should filter books by 'reading' status (active sessions)", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Currently Reading",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "To Read Book",
        authors: ["Author 2"],
        tags: [],
        totalPages: 400,
      });

      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        startedDate: new Date(),
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "to-read",
        isActive: true,
      });

      const request = createMockRequest("GET", "/api/books?status=reading");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Currently Reading");
      expect(data.books[0].status).toBe("reading");
    });

    test("should filter books by 'read' status (archived sessions)", async () => {
      // Arrange: Create a book with archived 'read' session
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Finished Book",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Reading Book",
        authors: ["Author 2"],
        tags: [],
        totalPages: 400,
      });

      // Archived session (isActive: false) for 'read' status
      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date("2024-01-01"),
        completedDate: new Date("2024-01-15"),
        isActive: false, // Archived
        rating: 5,
      });

      // Active session for 'reading' status
      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Act
      const request = createMockRequest("GET", "/api/books?status=read");
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Finished Book");
      expect(data.books[0].status).toBe("read");
      expect(data.books[0].rating).toBe(5);
      expect(data.total).toBe(1);
    });

    test("should include book with multiple archived 'read' sessions in read filter", async () => {
      // Arrange: Book that has been read twice (re-reading scenario)
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Book Read Twice",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
      });

      // First read (archived)
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        startedDate: new Date("2023-01-01"),
        completedDate: new Date("2023-01-15"),
        isActive: false,
        rating: 4,
      });

      // Second read (archived more recently)
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        startedDate: new Date("2024-01-01"),
        completedDate: new Date("2024-01-15"),
        isActive: false,
        rating: 5,
      });

      // Act
      const request = createMockRequest("GET", "/api/books?status=read");
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Book Read Twice");
      expect(data.books[0].status).toBe("read");
      // Should return most recent read session rating
      expect(data.books[0].rating).toBe(5);
    });

    test("should not include books with active sessions when filtering by 'read'", async () => {
      // Arrange: Book with active 'reading' session
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Currently Reading",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      // Act
      const request = createMockRequest("GET", "/api/books?status=read");
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(0);
    });

    test("should not include archived 'read' sessions when filtering by other statuses", async () => {
      // Arrange: Book with archived 'read' session
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Finished Book",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
      });

      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        completedDate: new Date(),
        isActive: false,
      });

      // Act: Try to find it with 'reading' filter
      const request = createMockRequest("GET", "/api/books?status=reading");
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(0);
    });
  });

  // ============================================================================
  // SEARCH FUNCTIONALITY TESTS
  // ============================================================================

  describe("Search Functionality", () => {
    test("should search books by title (case-insensitive)", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "The Great Gatsby",
        authors: ["F. Scott Fitzgerald"],
        tags: [],
        totalPages: 200,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "To Kill a Mockingbird",
        authors: ["Harper Lee"],
        tags: [],
        totalPages: 300,
      });

      const request = createMockRequest("GET", "/api/books?search=gatsby");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("The Great Gatsby");
    });

    test("should search books by author (case-insensitive)", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "1984",
        authors: ["George Orwell"],
        tags: [],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Pride and Prejudice",
        authors: ["Jane Austen"],
        tags: [],
        totalPages: 400,
      });

      const request = createMockRequest("GET", "/api/books?search=orwell");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("1984");
    });

    test("should return multiple books matching search term", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Harry Potter and the Philosopher's Stone",
        authors: ["J.K. Rowling"],
        tags: [],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Harry Potter and the Chamber of Secrets",
        authors: ["J.K. Rowling"],
        tags: [],
        totalPages: 350,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "test/path/3",
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        tags: [],
        totalPages: 400,
      });

      const request = createMockRequest("GET", "/api/books?search=harry potter");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(2);
    });
  });

  // ============================================================================
  // TAG FILTERING TESTS
  // ============================================================================

  describe("Tag Filtering", () => {
    test("should filter books by single tag", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Fiction Book",
        authors: ["Author 1"],
        tags: ["fiction", "adventure"],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Non-Fiction Book",
        authors: ["Author 2"],
        tags: ["non-fiction", "biography"],
        totalPages: 400,
      });

      const request = createMockRequest("GET", "/api/books?tags=fiction");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Fiction Book");
    });

    test("should filter books by multiple tags (OR logic)", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Fantasy Book",
        authors: ["Author 1"],
        tags: ["fantasy", "magic"],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Sci-Fi Book",
        authors: ["Author 2"],
        tags: ["sci-fi", "space"],
        totalPages: 400,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "test/path/3",
        title: "Mystery Book",
        authors: ["Author 3"],
        tags: ["mystery", "thriller"],
        totalPages: 350,
      });

      const request = createMockRequest("GET", "/api/books?tags=fantasy,sci-fi");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(2);
    });
  });

  // ============================================================================
  // PAGINATION TESTS
  // ============================================================================

  describe("Pagination", () => {
    test("should return limited number of books", async () => {
      // Create 10 books
      for (let i = 1; i <= 10; i++) {
        await bookRepository.create({
          calibreId: i,
          path: `test/path/${i}`,
          title: `Book ${i}`,
          authors: ["Author"],
          tags: [],
          totalPages: 300,
        });
      }

      const request = createMockRequest("GET", "/api/books?limit=5");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(5);
      expect(data.total).toBe(10);
      expect(data.limit).toBe(5);
    });

    test("should skip books for pagination", async () => {
      // Create books A-E
      const titles = ["Alpha", "Beta", "Charlie", "Delta", "Echo"];
      for (const title of titles) {
        await bookRepository.create({
          calibreId: titles.indexOf(title) + 1,
          path: `test/path/${titles.indexOf(title) + 1}`,
          title,
          authors: ["Author"],
          tags: [],
          totalPages: 300,
        });
      }

      const request = createMockRequest("GET", "/api/books?limit=2&skip=2&sortBy=title");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(2);
      expect(data.books[0].title).toBe("Charlie"); // Sorted alphabetically
      expect(data.books[1].title).toBe("Delta");
      expect(data.skip).toBe(2);
    });
  });

  // ============================================================================
  // ORPHANED BOOKS TESTS
  // ============================================================================

  describe("Orphaned Books", () => {
    test("should exclude orphaned books by default", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Normal Book",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
        orphaned: false,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Orphaned Book",
        authors: ["Author 2"],
        tags: [],
        totalPages: 400,
        orphaned: true,
      });

      const request = createMockRequest("GET", "/api/books");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Normal Book");
    });

    test("should show only orphaned books when showOrphaned=true", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Normal Book",
        authors: ["Author 1"],
        tags: [],
        totalPages: 300,
        orphaned: false,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Orphaned Book",
        authors: ["Author 2"],
        tags: [],
        totalPages: 400,
        orphaned: true,
      });

      const request = createMockRequest("GET", "/api/books?showOrphaned=true");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Orphaned Book");
    });
  });

  // ============================================================================
  // COMBINED FILTERS TESTS
  // ============================================================================

  describe("Combined Filters", () => {
    test("should filter by status AND search", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Harry Potter Reading",
        authors: ["J.K. Rowling"],
        tags: [],
        totalPages: 300,
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Harry Potter Read",
        authors: ["J.K. Rowling"],
        tags: [],
        totalPages: 350,
      });

      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "read",
        completedDate: new Date(),
        isActive: false,
      });

      const request = createMockRequest("GET", "/api/books?status=reading&search=harry");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Harry Potter Reading");
    });

    test("should filter by status AND tags", async () => {
      const book1 = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Fantasy Book Reading",
        authors: ["Author 1"],
        tags: ["fantasy", "magic"],
        totalPages: 300,
      });

      const book2 = await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Sci-Fi Book Reading",
        authors: ["Author 2"],
        tags: ["sci-fi", "space"],
        totalPages: 400,
      });

      await sessionRepository.create({
        bookId: book1.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await sessionRepository.create({
        bookId: book2.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      const request = createMockRequest("GET", "/api/books?status=reading&tags=fantasy");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Fantasy Book Reading");
    });

    test("should filter by search AND tags", async () => {
      await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Harry Potter Fantasy",
        authors: ["J.K. Rowling"],
        tags: ["fantasy", "magic"],
        totalPages: 300,
      });

      await bookRepository.create({
        calibreId: 2,
        path: "test/path/2",
        title: "Lord of the Rings",
        authors: ["J.R.R. Tolkien"],
        tags: ["fantasy", "adventure"],
        totalPages: 400,
      });

      await bookRepository.create({
        calibreId: 3,
        path: "test/path/3",
        title: "Harry Potter Sci-Fi",
        authors: ["Different Author"],
        tags: ["sci-fi"],
        totalPages: 350,
      });

      const request = createMockRequest("GET", "/api/books?search=harry&tags=fantasy");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].title).toBe("Harry Potter Fantasy");
    });

    test("should apply status, search, tags, and pagination together", async () => {
      // Create multiple books with different statuses and tags
      for (let i = 1; i <= 5; i++) {
        const book = await bookRepository.create({
          calibreId: i,
          path: `test/path/${i}`,
          title: `Fantasy Book ${i}`,
          authors: ["Fantasy Author"],
          tags: ["fantasy"],
          totalPages: 300,
        });

        await sessionRepository.create({
          bookId: book.id,
          sessionNumber: 1,
          status: "reading",
          isActive: true,
        });
      }

      const request = createMockRequest(
        "GET",
        "/api/books?status=reading&search=fantasy&tags=fantasy&limit=2&skip=1"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(2);
      expect(data.total).toBe(5);
      expect(data.limit).toBe(2);
      expect(data.skip).toBe(1);
    });
  });

  // ============================================================================
  // PROGRESS TRACKING TESTS
  // ============================================================================

  describe("Progress Tracking", () => {
    test("should include latest progress for active session", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Book with Progress",
        authors: ["Author"],
        tags: [],
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 150,
        currentPercentage: 50,
        pagesRead: 150,
        progressDate: new Date(),
      });

      const request = createMockRequest("GET", "/api/books?status=reading");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].latestProgress).not.toBeNull();
      expect(data.books[0].latestProgress.currentPage).toBe(150);
      expect(data.books[0].latestProgress.currentPercentage).toBe(50);
    });

    test("should include latest progress for archived 'read' session", async () => {
      const book = await bookRepository.create({
        calibreId: 1,
        path: "test/path/1",
        title: "Completed Book",
        authors: ["Author"],
        tags: [],
        totalPages: 300,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        completedDate: new Date(),
        isActive: false,
      });

      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 100,
        pagesRead: 50,
        progressDate: new Date(),
      });

      const request = createMockRequest("GET", "/api/books?status=read");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(1);
      expect(data.books[0].latestProgress).not.toBeNull();
      expect(data.books[0].latestProgress.currentPercentage).toBe(100);
    });
  });
});

// ============================================================================
// POST /api/books TESTS
// ============================================================================

describe("POST /api/books", () => {
  test("should update book totalPages", async () => {
    const book = await bookRepository.create({
      calibreId: 1,
      path: "test/path/1",
      title: "Test Book",
      authors: ["Author"],
      tags: [],
      totalPages: 300,
    });

    const request = createMockRequest("POST", "/api/books", {
      calibreId: 1,
      totalPages: 400,
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalPages).toBe(400);

    // Verify in database
    const updatedBook = await bookRepository.findById(book.id);
    expect(updatedBook?.totalPages).toBe(400);
  });

  test("should return 404 for non-existent book", async () => {
    const request = createMockRequest("POST", "/api/books", {
      calibreId: 999,
      totalPages: 400,
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  test("should return 400 if calibreId is missing", async () => {
    const request = createMockRequest("POST", "/api/books", {
      totalPages: 400,
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
