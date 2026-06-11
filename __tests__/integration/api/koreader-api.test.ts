/**
 * KoReader API Routes Integration Tests
 * 
 * Tests the API endpoints for mappings and settings management.
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { koreaderMappingRepository } from "@/lib/repositories/koreader-mapping.repository";
import { settingsRepository } from "@/lib/repositories/settings.repository";
import { bookRepository } from "@/lib/repositories";
import {
  setupTestDatabase,
  clearTestDatabase,
  teardownTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("KoReader API Routes", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("Mappings Repository Integration", () => {
    test("should support full CRUD lifecycle", async () => {
      // Create book
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      // CREATE mapping
      const mapping = await koreaderMappingRepository.create({
        documentHash: "test-hash-123",
        bookId: book.id,
        mappingSource: "manual",
        deviceName: "Test Device",
      });

      expect(mapping.id).toBeDefined();
      expect(mapping.documentHash).toBe("test-hash-123");

      // READ by document hash
      const foundByHash = await koreaderMappingRepository.findByDocumentHash("test-hash-123");
      expect(foundByHash).not.toBeNull();
      expect(foundByHash!.bookId).toBe(book.id);

      // READ by ID
      const foundById = await koreaderMappingRepository.findById(mapping.id);
      expect(foundById).not.toBeNull();
      expect(foundById!.documentHash).toBe("test-hash-123");

      // READ by book ID
      const foundByBookId = await koreaderMappingRepository.findByBookId(book.id);
      expect(foundByBookId).toHaveLength(1);
      expect(foundByBookId[0].documentHash).toBe("test-hash-123");

      // UPDATE mapping
      const updated = await koreaderMappingRepository.update(mapping.id, {
        deviceName: "Updated Device",
        mappingSource: "auto_path",
      });
      expect(updated!.deviceName).toBe("Updated Device");
      expect(updated!.mappingSource).toBe("auto_path");

      // DELETE mapping
      const deleted = await koreaderMappingRepository.delete(mapping.id);
      expect(deleted).toBe(true);

      const afterDelete = await koreaderMappingRepository.findById(mapping.id);
      expect(afterDelete).toBeNull();
    });

    test("should handle cascade delete when book is deleted", async () => {
      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      await koreaderMappingRepository.create({
        documentHash: "cascade-test",
        bookId: book.id,
        mappingSource: "manual",
      });

      // Delete book
      await bookRepository.delete(book.id);

      // Mapping should be gone
      const mapping = await koreaderMappingRepository.findByDocumentHash("cascade-test");
      expect(mapping).toBeNull();
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
        documentHash: "old-hash",
        bookId: book1.id,
        mappingSource: "manual",
        lastSyncedAt: yesterday,
      });

      await koreaderMappingRepository.create({
        documentHash: "new-hash",
        bookId: book2.id,
        mappingSource: "auto_path",
        lastSyncedAt: now,
      });

      const all = await koreaderMappingRepository.findAll();
      expect(all).toHaveLength(2);
      // Most recent first
      expect(all[0].documentHash).toBe("new-hash");
      expect(all[1].documentHash).toBe("old-hash");
    });
  });

  describe("Settings Repository Integration", () => {
    test("should support KoReader settings workflow", async () => {
      // Set initial settings
      await settingsRepository.set("koreader_proxy_enabled", false);
      await settingsRepository.set("koreader_upstream_url", "https://sync.koreader.rocks");
      await settingsRepository.set("koreader_auto_progress_log", true);
      await settingsRepository.set("koreader_proxy_port", 7200);

      // Read as different types
      const enabled = await settingsRepository.getBoolean("koreader_proxy_enabled");
      expect(enabled).toBe(false);

      const upstream = await settingsRepository.get("koreader_upstream_url");
      expect(upstream).toBe("https://sync.koreader.rocks");

      const autoProgress = await settingsRepository.getBoolean("koreader_auto_progress_log");
      expect(autoProgress).toBe(true);

      const port = await settingsRepository.getNumber("koreader_proxy_port");
      expect(port).toBe(7200);

      // Update setting
      await settingsRepository.set("koreader_proxy_enabled", true);
      const nowEnabled = await settingsRepository.getBoolean("koreader_proxy_enabled");
      expect(nowEnabled).toBe(true);

      // Get multiple settings at once
      const bulk = await settingsRepository.getMany([
        "koreader_proxy_enabled",
        "koreader_upstream_url",
      ]);
      expect(bulk.size).toBe(2);
      expect(bulk.get("koreader_proxy_enabled")).toBe("true");
      expect(bulk.get("koreader_upstream_url")).toBe("https://sync.koreader.rocks");

      // Delete setting
      const deleted = await settingsRepository.delete("koreader_proxy_port");
      expect(deleted).toBe(true);
      const afterDelete = await settingsRepository.getNumber("koreader_proxy_port");
      expect(afterDelete).toBeNull();
    });

    test("should handle type conversions correctly", async () => {
      // Boolean conversions
      await settingsRepository.set("bool_test", true);
      expect(await settingsRepository.getBoolean("bool_test")).toBe(true);
      expect(await settingsRepository.get("bool_test")).toBe("true");

      await settingsRepository.set("bool_test", false);
      expect(await settingsRepository.getBoolean("bool_test")).toBe(false);

      // Number conversions
      await settingsRepository.set("num_test", 42);
      expect(await settingsRepository.getNumber("num_test")).toBe(42);
      expect(await settingsRepository.get("num_test")).toBe("42");

      await settingsRepository.set("num_test", -100);
      expect(await settingsRepository.getNumber("num_test")).toBe(-100);

      // Invalid number
      await settingsRepository.set("num_test", "not-a-number");
      expect(await settingsRepository.getNumber("num_test")).toBeNull();
    });
  });

  describe("Proxy Configuration Scenario", () => {
    test("should support complete proxy setup workflow", async () => {
      // Initial setup - proxy disabled
      await settingsRepository.set("koreader_proxy_enabled", false);
      await settingsRepository.set("koreader_upstream_url", "https://sync.koreader.rocks");
      await settingsRepository.set("koreader_auto_progress_log", true);

      // Create a book and mapping
      const book = await bookRepository.create({
        title: "The Hobbit",
        calibreId: 1,
        path: "/calibre/J.R.R. Tolkien/The Hobbit.epub",
      });

      const mapping = await koreaderMappingRepository.create({
        documentHash: "hobbit-hash-abc123",
        bookId: book.id,
        mappingSource: "auto_path",
      });

      // Verify setup
      const enabled = await settingsRepository.getBoolean("koreader_proxy_enabled");
      expect(enabled).toBe(false);

      const mappingExists = await koreaderMappingRepository.findByDocumentHash("hobbit-hash-abc123");
      expect(mappingExists).not.toBeNull();
      expect(mappingExists!.bookId).toBe(book.id);

      // Enable proxy
      await settingsRepository.set("koreader_proxy_enabled", true);
      const nowEnabled = await settingsRepository.getBoolean("koreader_proxy_enabled");
      expect(nowEnabled).toBe(true);

      // Simulate sync operation - update last synced
      await koreaderMappingRepository.updateLastSynced("hobbit-hash-abc123", new Date());

      const syncedMapping = await koreaderMappingRepository.findByDocumentHash("hobbit-hash-abc123");
      expect(syncedMapping!.lastSyncedAt).not.toBeNull();
    });
  });
});
