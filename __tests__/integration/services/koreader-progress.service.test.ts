/**
 * KoReader Progress Service Integration Tests
 * 
 * Tests the end-to-end flow of processing KoReader progress updates
 * and creating corresponding Tome progress logs.
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { koReaderProgressService } from "@/lib/services/koreader-progress.service";
import { koreaderMappingRepository } from "@/lib/repositories/koreader-mapping.repository";
import { settingsRepository } from "@/lib/repositories/settings.repository";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import {
  setupTestDatabase,
  clearTestDatabase,
  teardownTestDatabase,
} from "@/__tests__/helpers/db-setup";

describe("KoReaderProgressService", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  describe("processProgressUpdate", () => {
    test("should skip processing when auto-progress is disabled", async () => {
      await settingsRepository.set("koreader_auto_progress_log", false);

      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      await koreaderMappingRepository.create({
        documentHash: "test-hash",
        bookId: book.id,
        mappingSource: "manual",
      });

      await koReaderProgressService.processProgressUpdate({
        documentHash: "test-hash",
        percentage: 0.5,
        progress: "50%",
        device: "Test Device",
      });

      // No progress logs should be created
      const progressLogs = await progressRepository.findByBookId(book.id);
      expect(progressLogs).toHaveLength(0);
    });

    test("should skip processing when no mapping exists", async () => {
      await settingsRepository.set("koreader_auto_progress_log", true);

      await koReaderProgressService.processProgressUpdate({
        documentHash: "nonexistent-hash",
        percentage: 0.5,
        progress: "50%",
        device: "Test Device",
      });

      // No progress logs should be created
      const allProgress = await progressRepository.findAll();
      expect(allProgress).toHaveLength(0);
    });

    test("should create progress log with new session when none exists", async () => {
      await settingsRepository.set("koreader_auto_progress_log", true);

      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
        totalPages: 200,
      });

      await koreaderMappingRepository.create({
        documentHash: "test-hash",
        bookId: book.id,
        mappingSource: "auto_path",
        deviceName: "Kindle",
      });

      await koReaderProgressService.processProgressUpdate({
        documentHash: "test-hash",
        percentage: 0.5,
        progress: "50%",
        device: "Test Kindle",
      });

      // Check session was created
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe("reading");
      expect(sessions[0].isActive).toBe(true);

      // Check progress log was created
      const progressLogs = await progressRepository.findByBookId(book.id);
      expect(progressLogs).toHaveLength(1);
      expect(progressLogs[0].currentPercentage).toBe(50);
      expect(progressLogs[0].currentPage).toBe(100); // 50% of 200 pages
      expect(progressLogs[0].notes).toContain("Test Kindle");
    });

    test("should use existing active session", async () => {
      await settingsRepository.set("koreader_auto_progress_log", true);

      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
        totalPages: 300,
      });

      // Create existing session
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await koreaderMappingRepository.create({
        documentHash: "test-hash",
        bookId: book.id,
        mappingSource: "manual",
      });

      await koReaderProgressService.processProgressUpdate({
        documentHash: "test-hash",
        percentage: 0.75,
        progress: "75%",
        device: "Kobo",
      });

      // Should still have only one session
      const sessions = await sessionRepository.findAllByBookId(book.id);
      expect(sessions).toHaveLength(1);

      // Check progress log uses existing session
      const progressLogs = await progressRepository.findBySessionId(session.id);
      expect(progressLogs).toHaveLength(1);
      expect(progressLogs[0].currentPercentage).toBe(75);
      expect(progressLogs[0].currentPage).toBe(225); // 75% of 300 pages
    });

    test("should handle book without total pages", async () => {
      await settingsRepository.set("koreader_auto_progress_log", true);

      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
        // No totalPages
      });

      await koreaderMappingRepository.create({
        documentHash: "test-hash",
        bookId: book.id,
        mappingSource: "auto_path",
      });

      await koReaderProgressService.processProgressUpdate({
        documentHash: "test-hash",
        percentage: 0.6,
        progress: "60%",
        device: "Device",
      });

      // Check progress log was created with 0 pages
      const progressLogs = await progressRepository.findByBookId(book.id);
      expect(progressLogs).toHaveLength(1);
      expect(progressLogs[0].currentPercentage).toBe(60);
      expect(progressLogs[0].currentPage).toBe(0);
    });

    test("should auto-complete session at 100%", async () => {
      await settingsRepository.set("koreader_auto_progress_log", true);

      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
        totalPages: 250,
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
      });

      await koreaderMappingRepository.create({
        documentHash: "test-hash",
        bookId: book.id,
        mappingSource: "manual",
      });

      await koReaderProgressService.processProgressUpdate({
        documentHash: "test-hash",
        percentage: 1.0,
        progress: "100%",
        device: "Device",
      });

      // Check session was marked as complete
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession!.status).toBe("read");
      expect(updatedSession!.completedDate).not.toBeNull();

      // Check progress log exists
      const progressLogs = await progressRepository.findBySessionId(session.id);
      expect(progressLogs).toHaveLength(1);
      expect(progressLogs[0].currentPercentage).toBe(100);
    });

    test("should not re-complete already completed session", async () => {
      await settingsRepository.set("koreader_auto_progress_log", true);

      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read", // Already completed
        isActive: true,
        completedDate: "2024-01-01",
      });

      await koreaderMappingRepository.create({
        documentHash: "test-hash",
        bookId: book.id,
        mappingSource: "manual",
      });

      await koReaderProgressService.processProgressUpdate({
        documentHash: "test-hash",
        percentage: 1.0,
        progress: "100%",
        device: "Device",
      });

      // Check session status unchanged
      const updatedSession = await sessionRepository.findById(session.id);
      expect(updatedSession!.status).toBe("read");
      expect(updatedSession!.completedDate).toBe("2024-01-01");
    });

    test("should update mapping last synced timestamp", async () => {
      await settingsRepository.set("koreader_auto_progress_log", true);

      const book = await bookRepository.create({
        title: "Test Book",
        calibreId: 1,
        path: "/test/book.epub",
      });

      await koreaderMappingRepository.create({
        documentHash: "test-hash",
        bookId: book.id,
        mappingSource: "auto_path",
      });

      const beforeMapping = await koreaderMappingRepository.findByDocumentHash("test-hash");
      expect(beforeMapping!.lastSyncedAt).toBeNull();

      await koReaderProgressService.processProgressUpdate({
        documentHash: "test-hash",
        percentage: 0.3,
        progress: "30%",
        device: "Device",
      });

      const afterMapping = await koreaderMappingRepository.findByDocumentHash("test-hash");
      expect(afterMapping!.lastSyncedAt).not.toBeNull();
    });

    test("should handle errors gracefully without throwing", async () => {
      await settingsRepository.set("koreader_auto_progress_log", true);

      // This should not throw even though book doesn't exist
      await expect(
        koReaderProgressService.processProgressUpdate({
          documentHash: "invalid-hash-with-mapping-to-nonexistent-book",
          percentage: 0.5,
          progress: "50%",
          device: "Device",
        })
      ).resolves.toBeUndefined();
    });
  });
});
