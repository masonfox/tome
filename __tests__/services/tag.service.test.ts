import { describe, test, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { tagService } from "@/lib/services/tag.service";
import { bookRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { createTestBook } from "../fixtures/test-data";

/**
 * TagService Tests
 * 
 * Tests the tag-related methods in TagService which provide business logic
 * for tag management, including Calibre synchronization.
 * 
 * Coverage:
 * - getAllTags(): Get all unique tags
 * - getTagStats(): Get all tags with book counts
 * - countBooksWithTags(): Count books that have at least one tag
 * - getBooksByTag(): Find books by tag with pagination
 * - updateBookTags(): Update tags for a single book with Calibre sync
 * - renameTag(): Rename a tag across all books with Calibre sync
 * - deleteTag(): Delete a tag from all books with Calibre sync
 * - mergeTags(): Merge multiple tags into one with Calibre sync
 * - bulkDeleteTags(): Delete multiple tags with Calibre sync
 * - bulkUpdateTags(): Add/remove tags from multiple books with Calibre sync
 */

/**
 * Mock Rationale: Avoid file system I/O to Calibre's SQLite database during tests.
 * We mock Calibre service operations at the service boundary to verify our code properly:
 * (1) calls Calibre sync methods with correct data
 * (2) handles Calibre sync failures gracefully (best effort)
 * (3) suspends/resumes watcher for bulk operations
 */
let mockBatchUpdateCalibreTags = mock((updates: Array<{ calibreId: number; tags: string[] }>) => ({
  totalAttempted: updates.length,
  successCount: updates.length,
  failures: []
}));
let mockCalibreShouldFail = false;

mock.module("@/lib/services/calibre.service", () => ({
  calibreService: {
    batchUpdateTags: (updates: Array<{ calibreId: number; tags: string[] }>) => {
      if (mockCalibreShouldFail) {
        throw new Error("Calibre database is unavailable");
      }
      return mockBatchUpdateCalibreTags(updates);
    },
    updateTags: mock(() => {}),
    updateRating: mock(() => {}),
    readTags: mock(() => []),
    readRating: mock(() => null),
  },
  CalibreService: class {},
}));

// Mock Calibre watcher to track suspend/resume calls
let mockWatcherSuspendCalled = false;
let mockWatcherResumeCalled = false;
let mockWatcherResumeIgnorePeriod = 0;

mock.module("@/lib/calibre-watcher", () => ({
  calibreWatcher: {
    suspend: () => {
      mockWatcherSuspendCalled = true;
    },
    resume: () => {
      mockWatcherResumeCalled = true;
    },
    resumeWithIgnorePeriod: (durationMs: number = 3000) => {
      mockWatcherResumeCalled = true;
      mockWatcherResumeIgnorePeriod = durationMs;
    },
    start: mock(() => {}),
    stop: mock(() => {}),
  },
}));

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
  // Reset mock state
  mockBatchUpdateCalibreTags.mockClear();
  mockCalibreShouldFail = false;
  mockWatcherSuspendCalled = false;
  mockWatcherResumeCalled = false;
  mockWatcherResumeIgnorePeriod = 0;
});

describe("TagService.getTagStats()", () => {
  test("should return empty array when no books have tags", async () => {
    // Arrange: Book with no tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      tags: [],
    }));

    // Act
    const stats = await tagService.getTagStats();

    // Assert
    expect(stats).toEqual([]);
  });

  test("should return tag statistics with book counts", async () => {
    // Arrange: Books with various tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["Fantasy", "Magic"],
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: ["Fantasy", "Adventure"],
    }));

    await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Book 3",
      tags: ["Sci-Fi"],
    }));

    // Act
    const stats = await tagService.getTagStats();

    // Assert
    expect(stats).toHaveLength(4);
    expect(stats.find(s => s.name === "Fantasy")).toEqual({ name: "Fantasy", bookCount: 2 });
    expect(stats.find(s => s.name === "Magic")).toEqual({ name: "Magic", bookCount: 1 });
    expect(stats.find(s => s.name === "Adventure")).toEqual({ name: "Adventure", bookCount: 1 });
    expect(stats.find(s => s.name === "Sci-Fi")).toEqual({ name: "Sci-Fi", bookCount: 1 });
  });
});

describe("TagService.countBooksWithTags()", () => {
  test("should return 0 when no books have tags", async () => {
    // Arrange: Books with no tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: [],
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: [],
    }));

    // Act
    const count = await tagService.countBooksWithTags();

    // Assert
    expect(count).toBe(0);
  });

  test("should count books that have at least one tag", async () => {
    // Arrange: Mix of books with and without tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["Fantasy"],
    }));

    await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: [],
    }));

    await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Book 3",
      tags: ["Sci-Fi", "Adventure"],
    }));

    // Act
    const count = await tagService.countBooksWithTags();

    // Assert: 2 books have tags
    expect(count).toBe(2);
  });
});

describe("TagService.getBooksByTag()", () => {
  test("should return empty result when tag doesn't exist", async () => {
    // Arrange: Books with different tags
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      tags: ["Fantasy"],
    }));

    // Act
    const result = await tagService.getBooksByTag("NonExistent");

    // Assert
    expect(result.total).toBe(0);
    expect(result.books).toEqual([]);
  });

  test("should find books by tag", async () => {
    // Arrange: Books with various tags
    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["Fantasy", "Magic"],
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: ["Fantasy"],
    }));

    await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Book 3",
      tags: ["Sci-Fi"],
    }));

    // Act
    const result = await tagService.getBooksByTag("Fantasy");

    // Assert
    expect(result.total).toBe(2);
    expect(result.books).toHaveLength(2);
    expect(result.books.map(b => b.id).sort()).toEqual([book1.id, book2.id].sort());
  });

  test("should support pagination", async () => {
    // Arrange: Multiple books with same tag
    for (let i = 1; i <= 5; i++) {
      await bookRepository.create(createTestBook({
        calibreId: i,
        title: `Book ${i}`,
        tags: ["Fantasy"],
      }));
    }

    // Act: Get first page
    const page1 = await tagService.getBooksByTag("Fantasy", 2, 0);
    const page2 = await tagService.getBooksByTag("Fantasy", 2, 2);

    // Assert
    expect(page1.total).toBe(5);
    expect(page1.books).toHaveLength(2);
    expect(page2.total).toBe(5);
    expect(page2.books).toHaveLength(2);
    // Pages should have different books
    expect(page1.books[0].id).not.toBe(page2.books[0].id);
  });
});

describe("TagService.renameTag()", () => {
  test("should throw error when old tag name is empty", async () => {
    // Act & Assert
    await expect(tagService.renameTag("", "NewTag")).rejects.toThrow("Tag names cannot be empty");
  });

  test("should throw error when new tag name is empty", async () => {
    // Act & Assert
    await expect(tagService.renameTag("OldTag", "")).rejects.toThrow("Tag names cannot be empty");
  });

  test("should throw error when old and new tag names are the same", async () => {
    // Act & Assert
    await expect(tagService.renameTag("Tag", "Tag")).rejects.toThrow("Old and new tag names must be different");
  });

  test("should rename tag across all books", async () => {
    // Arrange: Books with the tag to rename
    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["OldTag", "KeepThis"],
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: ["OldTag"],
    }));

    const book3 = await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Book 3",
      tags: ["DifferentTag"],
    }));

    // Act
    const result = await tagService.renameTag("OldTag", "NewTag");

    // Assert: 2 books were updated
    expect(result.totalBooks).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);

    // Verify tags were renamed
    const updatedBook1 = await bookRepository.findById(book1.id);
    const updatedBook2 = await bookRepository.findById(book2.id);
    const updatedBook3 = await bookRepository.findById(book3.id);

    expect(updatedBook1?.tags).toEqual(["NewTag", "KeepThis"]);
    expect(updatedBook2?.tags).toEqual(["NewTag"]);
    expect(updatedBook3?.tags).toEqual(["DifferentTag"]); // Unchanged

    // Verify Calibre sync was called
    expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
    
    // Verify watcher was resumed with ignore period
    expect(mockWatcherResumeIgnorePeriod).toBe(3000);
  });

  test("should fail when Calibre sync fails (fail fast)", async () => {
    // Arrange: Book with tag to rename
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      tags: ["OldTag"],
    }));

    // Set Calibre to fail
    mockCalibreShouldFail = true;

    // Act & Assert: Should throw when Calibre sync fails
    await expect(tagService.renameTag("OldTag", "NewTag"))
      .rejects.toThrow("Calibre database is unavailable");

    // Verify Tome DB unchanged
    const unchangedBook = await bookRepository.findById(book.id);
    expect(unchangedBook?.tags).toEqual(["OldTag"]);
    
    // Verify watcher was still resumed with ignore period
    expect(mockWatcherResumeCalled).toBe(true);
    expect(mockWatcherResumeIgnorePeriod).toBe(3000);
  });
});

describe("TagService.deleteTag()", () => {
  test("should throw error when tag name is empty", async () => {
    // Act & Assert
    await expect(tagService.deleteTag("")).rejects.toThrow("Tag name cannot be empty");
  });

  test("should delete tag from all books", async () => {
    // Arrange: Books with the tag to delete
    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["DeleteMe", "KeepThis"],
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: ["DeleteMe"],
    }));

    const book3 = await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Book 3",
      tags: ["DifferentTag"],
    }));

    // Act
    const result = await tagService.deleteTag("DeleteMe");

    // Assert: 2 books were updated
    expect(result.successCount).toBe(2);

    // Verify tag was deleted
    const updatedBook1 = await bookRepository.findById(book1.id);
    const updatedBook2 = await bookRepository.findById(book2.id);
    const updatedBook3 = await bookRepository.findById(book3.id);

    expect(updatedBook1?.tags).toEqual(["KeepThis"]);
    expect(updatedBook2?.tags).toEqual([]);
    expect(updatedBook3?.tags).toEqual(["DifferentTag"]); // Unchanged

    // Verify Calibre sync was called
    expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
    
    // Verify watcher was resumed with ignore period
    expect(mockWatcherResumeIgnorePeriod).toBe(3000);
  });

  test("should return 0 when tag doesn't exist", async () => {
    // Arrange: Book with different tag
    await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      tags: ["KeepThis"],
    }));

    // Act
    const result = await tagService.deleteTag("NonExistent");

    // Assert
    expect(result.successCount).toBe(0);
    
    // Calibre sync should not be called for 0 books
    expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(0);
  });

  test("should fail when Calibre sync fails (fail fast)", async () => {
    // Arrange: Book with tag to delete
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      tags: ["DeleteMe"],
    }));

    // Set Calibre to fail
    mockCalibreShouldFail = true;

    // Act & Assert: Should throw when Calibre sync fails
    await expect(tagService.deleteTag("DeleteMe"))
      .rejects.toThrow("Calibre database is unavailable");

    // Verify Tome DB unchanged
    const unchangedBook = await bookRepository.findById(book.id);
    expect(unchangedBook?.tags).toEqual(["DeleteMe"]);
    
    // Verify watcher was still resumed with ignore period
    expect(mockWatcherResumeCalled).toBe(true);
    expect(mockWatcherResumeIgnorePeriod).toBe(3000);
  });
});

describe("TagService.mergeTags()", () => {
  test("should throw error when source tags is empty array", async () => {
    // Act & Assert
    await expect(tagService.mergeTags([], "Target")).rejects.toThrow("Source tags must be a non-empty array");
  });

  test("should throw error when source tags is not an array", async () => {
    // Act & Assert
    await expect(tagService.mergeTags("NotArray" as any, "Target")).rejects.toThrow("Source tags must be a non-empty array");
  });

  test("should throw error when target tag is empty", async () => {
    // Act & Assert
    await expect(tagService.mergeTags(["Tag1"], "")).rejects.toThrow("Target tag cannot be empty");
  });

  test("should merge multiple tags into target tag", async () => {
    // Arrange: Books with tags to merge
    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["Tag1", "KeepThis"],
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: ["Tag2"],
    }));

    const book3 = await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Book 3",
      tags: ["Tag1", "Tag2"],
    }));

    const book4 = await bookRepository.create(createTestBook({
      calibreId: 4,
      title: "Book 4",
      tags: ["DifferentTag"],
    }));

    // Act: Merge Tag1 and Tag2 into MergedTag
    const result = await tagService.mergeTags(["Tag1", "Tag2"], "MergedTag");

    // Assert: 3 books were updated
    expect(result.successCount).toBe(3);

    // Verify tags were merged
    const updatedBook1 = await bookRepository.findById(book1.id);
    const updatedBook2 = await bookRepository.findById(book2.id);
    const updatedBook3 = await bookRepository.findById(book3.id);
    const updatedBook4 = await bookRepository.findById(book4.id);

    expect(updatedBook1?.tags).toContain("MergedTag");
    expect(updatedBook1?.tags).toContain("KeepThis");
    expect(updatedBook1?.tags).not.toContain("Tag1");

    expect(updatedBook2?.tags).toEqual(["MergedTag"]);
    expect(updatedBook2?.tags).not.toContain("Tag2");

    expect(updatedBook3?.tags).toEqual(["MergedTag"]); // Deduplicated
    expect(updatedBook3?.tags).not.toContain("Tag1");
    expect(updatedBook3?.tags).not.toContain("Tag2");

    expect(updatedBook4?.tags).toEqual(["DifferentTag"]); // Unchanged

    // Verify watcher was suspended and resumed
    expect(mockWatcherSuspendCalled).toBe(true);
    expect(mockWatcherResumeCalled).toBe(true);
    expect(mockWatcherResumeIgnorePeriod).toBe(3000);

    // Verify Calibre sync was called
    expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
  });

  test("should fail when Calibre sync fails (fail fast)", async () => {
    // Arrange: Book with tags to merge
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      tags: ["Tag1"],
    }));

    // Set Calibre to fail
    mockCalibreShouldFail = true;

    // Act & Assert: Should throw when Calibre sync fails
    await expect(tagService.mergeTags(["Tag1"], "MergedTag"))
      .rejects.toThrow("Calibre database is unavailable");

    // Verify Tome DB unchanged
    const unchangedBook = await bookRepository.findById(book.id);
    expect(unchangedBook?.tags).toEqual(["Tag1"]);
    
    // Verify watcher was still resumed with ignore period
    expect(mockWatcherResumeCalled).toBe(true);
    expect(mockWatcherResumeIgnorePeriod).toBe(3000);
  });
});

describe("TagService.bulkDeleteTags()", () => {
  test("should throw error when tag names is empty array", async () => {
    // Act & Assert
    await expect(tagService.bulkDeleteTags([])).rejects.toThrow("Tag names must be a non-empty array");
  });

  test("should throw error when tag names is not an array", async () => {
    // Act & Assert
    await expect(tagService.bulkDeleteTags("NotArray" as any)).rejects.toThrow("Tag names must be a non-empty array");
  });

  test("should delete multiple tags", async () => {
    // Arrange: Books with tags to delete
    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["Delete1", "Keep"],
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: ["Delete2", "Keep"],
    }));

    const book3 = await bookRepository.create(createTestBook({
      calibreId: 3,
      title: "Book 3",
      tags: ["Delete1", "Delete2"],
    }));

    // Act: Delete both Delete1 and Delete2
    const result = await tagService.bulkDeleteTags(["Delete1", "Delete2"]);

    // Assert
    expect(result.tagsDeleted).toBe(2);
    expect(result.successCount).toBeGreaterThan(0);

    // Verify tags were deleted
    const updatedBook1 = await bookRepository.findById(book1.id);
    const updatedBook2 = await bookRepository.findById(book2.id);
    const updatedBook3 = await bookRepository.findById(book3.id);

    expect(updatedBook1?.tags).toEqual(["Keep"]);
    expect(updatedBook2?.tags).toEqual(["Keep"]);
    expect(updatedBook3?.tags).toEqual([]);

    // Verify watcher was suspended and resumed
    expect(mockWatcherSuspendCalled).toBe(true);
    expect(mockWatcherResumeCalled).toBe(true);
    expect(mockWatcherResumeIgnorePeriod).toBe(3000);

    // Verify Calibre sync was called (once per tag)
    expect(mockBatchUpdateCalibreTags.mock.calls.length).toBeGreaterThan(0);
  });

  test("should fail when Calibre sync fails (fail fast)", async () => {
    // Arrange: Books with tags
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      tags: ["Delete1"],
    }));

    // Set Calibre to fail
    mockCalibreShouldFail = true;

    // Act & Assert: Should throw when Calibre sync fails
    await expect(tagService.bulkDeleteTags(["Delete1"]))
      .rejects.toThrow("Calibre database is unavailable");

    // Verify Tome DB unchanged
    const unchangedBook = await bookRepository.findById(book.id);
    expect(unchangedBook?.tags).toEqual(["Delete1"]);
    
    // Verify watcher was still resumed with ignore period
    expect(mockWatcherResumeCalled).toBe(true);
    expect(mockWatcherResumeIgnorePeriod).toBe(3000);
  });
});

describe("TagService.bulkUpdateTags()", () => {
  test("should throw error when book IDs is empty array", async () => {
    // Act & Assert
    await expect(tagService.bulkUpdateTags([], "add", ["Tag"])).rejects.toThrow("Book IDs must be a non-empty array");
  });

  test("should throw error when tags is empty array", async () => {
    // Act & Assert
    await expect(tagService.bulkUpdateTags([1], "add", [])).rejects.toThrow("Tags must be a non-empty array");
  });

  test("should throw error when action is invalid", async () => {
    // Act & Assert
    await expect(tagService.bulkUpdateTags([1], "invalid" as any, ["Tag"])).rejects.toThrow("Action must be 'add' or 'remove'");
  });

  test("should add tags to multiple books", async () => {
    // Arrange: Books to add tags to
    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["Existing"],
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: [],
    }));

    // Act: Add tags to both books
    const result = await tagService.bulkUpdateTags(
      [book1.id, book2.id],
      "add",
      ["NewTag1", "NewTag2"]
    );

    // Assert
    expect(result.booksUpdated).toBe(2);

    // Verify tags were added
    const updatedBook1 = await bookRepository.findById(book1.id);
    const updatedBook2 = await bookRepository.findById(book2.id);

    expect(updatedBook1?.tags).toContain("Existing");
    expect(updatedBook1?.tags).toContain("NewTag1");
    expect(updatedBook1?.tags).toContain("NewTag2");

    expect(updatedBook2?.tags).toContain("NewTag1");
    expect(updatedBook2?.tags).toContain("NewTag2");

    // Verify Calibre sync was called
    expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
  });

  test("should remove tags from multiple books", async () => {
    // Arrange: Books to remove tags from
    const book1 = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book 1",
      tags: ["Remove1", "Remove2", "Keep"],
    }));

    const book2 = await bookRepository.create(createTestBook({
      calibreId: 2,
      title: "Book 2",
      tags: ["Remove1", "Keep"],
    }));

    // Act: Remove tags from both books
    const result = await tagService.bulkUpdateTags(
      [book1.id, book2.id],
      "remove",
      ["Remove1", "Remove2"]
    );

    // Assert
    expect(result.booksUpdated).toBe(2);

    // Verify tags were removed
    const updatedBook1 = await bookRepository.findById(book1.id);
    const updatedBook2 = await bookRepository.findById(book2.id);

    expect(updatedBook1?.tags).toEqual(["Keep"]);
    expect(updatedBook2?.tags).toEqual(["Keep"]);

    // Verify Calibre sync was called
    expect(mockBatchUpdateCalibreTags).toHaveBeenCalledTimes(1);
  });

  test("should handle Calibre sync failures gracefully", async () => {
    // Arrange: Book to update
    const book = await bookRepository.create(createTestBook({
      calibreId: 1,
      title: "Book",
      tags: [],
    }));

    // Set Calibre to fail
    mockCalibreShouldFail = true;

    // Act: Should not throw even if Calibre sync fails
    const result = await tagService.bulkUpdateTags([book.id], "add", ["NewTag"]);

    // Assert: Database update succeeded
    expect(result.booksUpdated).toBe(1);
  });
});
