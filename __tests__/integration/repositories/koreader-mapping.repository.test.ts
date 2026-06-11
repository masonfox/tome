/**
 * KoReader Mapping Repository Tests
 * 
 * Tests CRUD operations for KoReader document-to-book mappings
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { koreaderMappingRepository } from "@/lib/repositories/koreader-mapping.repository";
import { bookRepository } from "@/lib/repositories";
import {
  setupTestDatabase,
  clearTestDatabase,
  teardownTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("KoReaderMappingRepository", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("findByDocumentHash", () => {
    test("should return null when mapping does not exist", async () => {
      const result = await koreaderMappingRepository.findByDocumentHash("nonexistent-hash");
      expect(result).toBeNull();
    });

    test("should find mapping by document hash", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const mapping = await koreaderMappingRepository.create({
        documentHash: "test-hash-123",
        bookId: book.id,
        mappingSource: "manual",
      });

      const found = await koreaderMappingRepository.findByDocumentHash("test-hash-123");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(mapping.id);
      expect(found!.documentHash).toBe("test-hash-123");
      expect(found!.bookId).toBe(book.id);
      expect(found!.mappingSource).toBe("manual");
    });
  });

  describe("findByBookId", () => {
    test("should return empty array when no mappings exist for book", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const result = await koreaderMappingRepository.findByBookId(book.id);
      expect(result).toEqual([]);
    });

    test("should find all mappings for a book", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      await koreaderMappingRepository.create({
        documentHash: "hash-1",
        bookId: book.id,
        mappingSource: "auto_path",
        deviceName: "Kindle",
      });

      await koreaderMappingRepository.create({
        documentHash: "hash-2",
        bookId: book.id,
        mappingSource: "manual",
        deviceName: "Kobo",
      });

      const mappings = await koreaderMappingRepository.findByBookId(book.id);
      expect(mappings).toHaveLength(2);
      expect(mappings.map(m => m.documentHash)).toContain("hash-1");
      expect(mappings.map(m => m.documentHash)).toContain("hash-2");
    });
  });

  describe("create", () => {
    test("should create a new mapping with minimal data", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const mapping = await koreaderMappingRepository.create({
        documentHash: "new-hash",
        bookId: book.id,
        mappingSource: "auto_path",
      });

      expect(mapping.id).toBeDefined();
      expect(mapping.documentHash).toBe("new-hash");
      expect(mapping.bookId).toBe(book.id);
      expect(mapping.mappingSource).toBe("auto_path");
      expect(mapping.deviceName).toBeNull();
      expect(mapping.lastSyncedAt).toBeNull();
      expect(mapping.createdAt).toBeDefined();
      expect(mapping.updatedAt).toBeDefined();
    });

    test("should create a new mapping with all fields", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const syncTime = new Date();
      const mapping = await koreaderMappingRepository.create({
        documentHash: "full-hash",
        bookId: book.id,
        mappingSource: "manual",
        deviceName: "My Kindle",
        lastSyncedAt: syncTime,
      });

      expect(mapping.documentHash).toBe("full-hash");
      expect(mapping.deviceName).toBe("My Kindle");
      // SQLite stores timestamps as seconds, so compare after truncating milliseconds
      expect(Math.floor(mapping.lastSyncedAt!.getTime() / 1000)).toBe(Math.floor(syncTime.getTime() / 1000));
    });
  });

  describe("update", () => {
    test("should update mapping fields", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const mapping = await koreaderMappingRepository.create({
        documentHash: "update-hash",
        bookId: book.id,
        mappingSource: "auto_path",
      });

      const updated = await koreaderMappingRepository.update(mapping.id, {
        mappingSource: "manual",
        deviceName: "Updated Device",
      });

      expect(updated).not.toBeNull();
      expect(updated!.id).toBe(mapping.id);
      expect(updated!.mappingSource).toBe("manual");
      expect(updated!.deviceName).toBe("Updated Device");
      expect(updated!.documentHash).toBe("update-hash"); // Unchanged
    });

    test("should return null when updating non-existent mapping", async () => {
      const result = await koreaderMappingRepository.update(99999, {
        deviceName: "Ghost Device",
      });
      expect(result).toBeNull();
    });
  });

  describe("updateLastSynced", () => {
    test("should update last synced timestamp", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      await koreaderMappingRepository.create({
        documentHash: "sync-hash",
        bookId: book.id,
        mappingSource: "auto_path",
      });

      const syncTime = new Date();
      await koreaderMappingRepository.updateLastSynced("sync-hash", syncTime);

      const found = await koreaderMappingRepository.findByDocumentHash("sync-hash");
      expect(found).not.toBeNull();
      // SQLite stores timestamps as seconds, so compare after truncating milliseconds
      expect(Math.floor(found!.lastSyncedAt!.getTime() / 1000)).toBe(Math.floor(syncTime.getTime() / 1000));
    });
  });

  describe("delete", () => {
    test("should delete mapping and return true", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const mapping = await koreaderMappingRepository.create({
        documentHash: "delete-hash",
        bookId: book.id,
        mappingSource: "manual",
      });

      const result = await koreaderMappingRepository.delete(mapping.id);
      expect(result).toBe(true);

      const found = await koreaderMappingRepository.findByDocumentHash("delete-hash");
      expect(found).toBeNull();
    });

    test("should return false when deleting non-existent mapping", async () => {
      const result = await koreaderMappingRepository.delete(99999);
      expect(result).toBe(false);
    });

    test("should cascade delete when book is deleted", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      await koreaderMappingRepository.create({
        documentHash: "cascade-hash",
        bookId: book.id,
        mappingSource: "auto_path",
      });

      // Delete the book
      await bookRepository.delete(book.id);

      // Mapping should be gone
      const found = await koreaderMappingRepository.findByDocumentHash("cascade-hash");
      expect(found).toBeNull();
    });
  });

  describe("findAll", () => {
    test("should return empty array when no mappings exist", async () => {
      const result = await koreaderMappingRepository.findAll();
      expect(result).toEqual([]);
    });

    test("should return all mappings ordered by last synced", async () => {
      const book1 = await bookRepository.create({
        title: "Book 1",
        calibreId: 1,
        path: "/test/book1.epub",
      });

      const book2 = await bookRepository.create({
        title: "Book 2",
        calibreId: 2,
        path: "/test/book2.epub",
      });

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await koreaderMappingRepository.create({
        documentHash: "hash-old",
        bookId: book1.id,
        mappingSource: "auto_path",
        lastSyncedAt: yesterday,
      });

      await koreaderMappingRepository.create({
        documentHash: "hash-new",
        bookId: book2.id,
        mappingSource: "manual",
        lastSyncedAt: now,
      });

      const mappings = await koreaderMappingRepository.findAll();
      expect(mappings).toHaveLength(2);
      // Most recent first
      expect(mappings[0].documentHash).toBe("hash-new");
      expect(mappings[1].documentHash).toBe("hash-old");
    });
  });

  describe("count", () => {
    test("should return 0 when no mappings exist", async () => {
      const count = await koreaderMappingRepository.count();
      expect(count).toBe(0);
    });

    test("should return correct count", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      await koreaderMappingRepository.create({
        documentHash: "count-1",
        bookId: book.id,
        mappingSource: "auto_path",
      });

      await koreaderMappingRepository.create({
        documentHash: "count-2",
        bookId: book.id,
        mappingSource: "manual",
      });

      const count = await koreaderMappingRepository.count();
      expect(count).toBe(2);
    });
  });
});
