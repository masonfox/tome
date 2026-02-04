import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { GET } from "@/app/api/tags/route";

/**
 * GET /api/tags Endpoint Tests
 * 
 * Tests the GET /api/tags endpoint which returns all unique tags
 * from all books in the library.
 * 
 * Coverage:
 * - Returns tags in correct format { tags: string[] }
 * - Returns unique tags only (no duplicates)
 * - Returns empty array when no books exist
 * - Includes tags from all books
 */

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("GET /api/tags", () => {
  test("should return tags in correct format with { tags: string[] }", async () => {
    // Create books with tags
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: ["Fantasy", "Adventure"],
      path: "Author 1/Book 1 (1)",
    });

    await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: ["Science Fiction", "Space Opera"],
      path: "Author 2/Book 2 (2)",
    });

    const response = await GET();
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty("tags");
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags.length).toBeGreaterThan(0);
  });

  test("should return all unique tags from all books", async () => {
    // Create books with various tags
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: ["Fantasy", "Adventure", "Magic"],
      path: "Author 1/Book 1 (1)",
    });

    await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: ["Science Fiction", "Space Opera"],
      path: "Author 2/Book 2 (2)",
    });

    await bookRepository.create({
      calibreId: 3,
      title: "Book 3",
      authors: ["Author 3"],
      tags: ["Fantasy", "Epic"],
      path: "Author 3/Book 3 (3)",
    });

    const response = await GET();
    const data = await response.json();

    // Verify all unique tags are included
    expect(data.tags).toContain("Fantasy");
    expect(data.tags).toContain("Adventure");
    expect(data.tags).toContain("Magic");
    expect(data.tags).toContain("Science Fiction");
    expect(data.tags).toContain("Space Opera");
    expect(data.tags).toContain("Epic");

    // Verify no duplicates (Fantasy appears in 2 books but should only be listed once)
    const uniqueTags = new Set(data.tags);
    expect(data.tags.length).toBe(uniqueTags.size);
  });

  test("should return empty array when no books exist", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty("tags");
    expect(data.tags).toEqual([]);
  });

  test("should return empty array when books have no tags", async () => {
    // Create books without tags
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: [],
      path: "Author 1/Book 1 (1)",
    });

    await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: [],
      path: "Author 2/Book 2 (2)",
    });

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty("tags");
    expect(data.tags).toEqual([]);
  });

  test("should handle books with mixed empty and non-empty tags", async () => {
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: ["Fantasy", "Magic"],
      path: "Author 1/Book 1 (1)",
    });

    await bookRepository.create({
      calibreId: 2,
      title: "Book 2",
      authors: ["Author 2"],
      tags: [],
      path: "Author 2/Book 2 (2)",
    });

    await bookRepository.create({
      calibreId: 3,
      title: "Book 3",
      authors: ["Author 3"],
      tags: ["Science Fiction"],
      path: "Author 3/Book 3 (3)",
    });

    const response = await GET();
    const data = await response.json();

    expect(data.tags).toContain("Fantasy");
    expect(data.tags).toContain("Magic");
    expect(data.tags).toContain("Science Fiction");
    expect(data.tags.length).toBe(3);
  });

  test("should return tags with special characters correctly", async () => {
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: ["Science Fiction & Fantasy", "High-Tech", "Books & Reading"],
      path: "Author 1/Book 1 (1)",
    });

    const response = await GET();
    const data = await response.json();

    expect(data.tags).toContain("Science Fiction & Fantasy");
    expect(data.tags).toContain("High-Tech");
    expect(data.tags).toContain("Books & Reading");
  });

  test("should handle case-sensitive tags as distinct values", async () => {
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: ["fantasy", "Fantasy", "FANTASY"],
      path: "Author 1/Book 1 (1)",
    });

    const response = await GET();
    const data = await response.json();

    // Tags should be treated as case-sensitive and all three should be present
    expect(data.tags).toContain("fantasy");
    expect(data.tags).toContain("Fantasy");
    expect(data.tags).toContain("FANTASY");
  });

  test("should return 200 status code on success", async () => {
    await bookRepository.create({
      calibreId: 1,
      title: "Book 1",
      authors: ["Author 1"],
      tags: ["Fantasy"],
      path: "Author 1/Book 1 (1)",
    });

    const response = await GET();
    
    expect(response.status).toBe(200);
  });
});
