// Import shared mock setup (must be first to properly mock modules)
import "./setup";

import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { SessionService } from "@/lib/services/session.service";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase } from "../../helpers/db-setup";
import { createTestBook } from "../../fixtures/test-data";

let instance: any;

describe("SessionService - Mark as Read Strategies", () => {
  let sessionService: SessionService;

  beforeEach(async () => {
    instance = await setupTestDatabase(__filename);
    await clearTestDatabase(instance);
    sessionService = new SessionService();
  });

  afterAll(async () => {
    await teardownTestDatabase(instance);
  });

  describe("selectMarkAsReadStrategy", () => {
    test("selects AlreadyReadStrategy when book is already read", () => {
      const book = { id: 1, totalPages: 300 };
      const isAlreadyRead = true;
      const has100Progress = false;

      // Access private method via type assertion for testing
      const result = (sessionService as any).selectMarkAsReadStrategy(
        book,
        isAlreadyRead,
        has100Progress
      );

      expect(result.name).toBe("AlreadyRead");
      expect(result.strategy).toBeDefined();
    });

    test("selects CreateProgressStrategy when has pages but no 100% progress", () => {
      const book = { id: 1, totalPages: 300 };
      const isAlreadyRead = false;
      const has100Progress = false;

      const result = (sessionService as any).selectMarkAsReadStrategy(
        book,
        isAlreadyRead,
        has100Progress
      );

      expect(result.name).toBe("CreateProgress");
      expect(result.strategy).toBeDefined();
    });

    test("selects DirectStatusChangeStrategy when has pages and 100% progress", () => {
      const book = { id: 1, totalPages: 300 };
      const isAlreadyRead = false;
      const has100Progress = true;

      const result = (sessionService as any).selectMarkAsReadStrategy(
        book,
        isAlreadyRead,
        has100Progress
      );

      expect(result.name).toBe("DirectStatusChange");
      expect(result.strategy).toBeDefined();
    });

    test("selects ManualSessionUpdateStrategy when no totalPages", () => {
      const book = { id: 1, totalPages: null };
      const isAlreadyRead = false;
      const has100Progress = false;

      const result = (sessionService as any).selectMarkAsReadStrategy(
        book,
        isAlreadyRead,
        has100Progress
      );

      expect(result.name).toBe("ManualSessionUpdate");
      expect(result.strategy).toBeDefined();
    });

    test("prioritizes AlreadyReadStrategy over other conditions", () => {
      // Even if book has pages and progress, if already read, use AlreadyReadStrategy
      const book = { id: 1, totalPages: 300 };
      const isAlreadyRead = true;
      const has100Progress = true;

      const result = (sessionService as any).selectMarkAsReadStrategy(
        book,
        isAlreadyRead,
        has100Progress
      );

      expect(result.name).toBe("AlreadyRead");
    });

    test("selects ManualSessionUpdateStrategy when totalPages is 0", () => {
      const book = { id: 1, totalPages: 0 };
      const isAlreadyRead = false;
      const has100Progress = false;

      const result = (sessionService as any).selectMarkAsReadStrategy(
        book,
        isAlreadyRead,
        has100Progress
      );

      expect(result.name).toBe("ManualSessionUpdate");
    });
  });

  describe("createProgressStrategy", () => {
    test("creates 100% progress and returns correct result", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create an active session
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: session,
        has100Progress: false,
        isAlreadyRead: false,
        completedDate: new Date(),
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).createProgressStrategy(context);

      expect(result.progressCreated).toBe(true);
      expect(result.sessionId).toBeDefined();
    });

    test("works when activeSession is null", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: null,
        has100Progress: false,
        isAlreadyRead: false,
        completedDate: new Date(),
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).createProgressStrategy(context);

      expect(result.progressCreated).toBe(true);
      // Session ID might be undefined since no active session was provided
      // The strategy will create one via ensureReadingStatus
    });
  });

  describe("directStatusChangeStrategy", () => {
    test("updates status directly and returns session ID", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      // Create a 100% progress entry
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPage: 300,
        currentPercentage: 100,
        progressDate: new Date(),
        pagesRead: 300,
      });

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: session,
        has100Progress: true,
        isAlreadyRead: false,
        completedDate: new Date(),
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).directStatusChangeStrategy(context);

      expect(result.progressCreated).toBe(false);
      expect(result.sessionId).toBeDefined();

      // Verify session was updated to "read"
      const updatedSession = await sessionRepository.findById(result.sessionId!);
      expect(updatedSession?.status).toBe("read");
      expect(updatedSession?.isActive).toBe(false);
    });

    test("uses provided completedDate", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      const customDate = new Date("2024-01-15");

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: session,
        has100Progress: true,
        isAlreadyRead: false,
        completedDate: customDate,
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).directStatusChangeStrategy(context);

      const updatedSession = await sessionRepository.findById(result.sessionId!);
      expect(updatedSession?.completedDate).toEqual(customDate);
    });
  });

  describe("manualSessionUpdateStrategy", () => {
    test("updates existing active session to read", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "reading",
        isActive: true,
        startedDate: new Date(),
      });

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: session,
        has100Progress: false,
        isAlreadyRead: false,
        completedDate: new Date(),
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).manualSessionUpdateStrategy(context);

      expect(result.progressCreated).toBe(false);
      expect(result.sessionId).toBeDefined();

      const updatedSession = await sessionRepository.findById(result.sessionId!);
      expect(updatedSession?.status).toBe("read");
      expect(updatedSession?.isActive).toBe(false);
    });

    test("creates new session when no active session exists", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: null,
        has100Progress: false,
        isAlreadyRead: false,
        completedDate: new Date(),
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).manualSessionUpdateStrategy(context);

      expect(result.progressCreated).toBe(false);
      expect(result.sessionId).toBeDefined();

      const newSession = await sessionRepository.findById(result.sessionId!);
      expect(newSession?.status).toBe("read");
      expect(newSession?.isActive).toBe(false);
      expect(newSession?.sessionNumber).toBe(1);
    });

    test("uses custom completedDate when provided", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: null }));

      const customDate = new Date("2024-06-15");

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: null,
        has100Progress: false,
        isAlreadyRead: false,
        completedDate: customDate,
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).manualSessionUpdateStrategy(context);

      const newSession = await sessionRepository.findById(result.sessionId!);
      expect(newSession?.completedDate).toEqual(customDate);
      expect(newSession?.startedDate).toEqual(customDate);
    });
  });

  describe("alreadyReadStrategy", () => {
    test("finds and returns most recent completed session", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create a completed session
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        startedDate: new Date("2024-01-01"),
        completedDate: new Date("2024-01-15"),
      });

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: null,
        has100Progress: false,
        isAlreadyRead: true,
        completedDate: undefined,
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).alreadyReadStrategy(context);

      expect(result.progressCreated).toBe(false);
      expect(result.sessionId).toBe(session.id);
    });

    test("returns undefined sessionId when no completed sessions exist", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: null,
        has100Progress: false,
        isAlreadyRead: true,
        completedDate: undefined,
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).alreadyReadStrategy(context);

      expect(result.progressCreated).toBe(false);
      expect(result.sessionId).toBeUndefined();
    });

    test("returns most recent when multiple completed sessions exist", async () => {
      const book = await bookRepository.create(createTestBook({ totalPages: 300 }));

      // Create multiple completed sessions
      await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 1,
        status: "read",
        isActive: false,
        startedDate: new Date("2024-01-01"),
        completedDate: new Date("2024-01-15"),
      });

      const mostRecent = await sessionRepository.create({
        bookId: book.id,
        sessionNumber: 2,
        status: "read",
        isActive: false,
        startedDate: new Date("2024-06-01"),
        completedDate: new Date("2024-06-30"),
      });

      const { getLogger } = require("@/lib/logger");
      const logger = getLogger();

      const context = {
        bookId: book.id,
        book,
        activeSession: null,
        has100Progress: false,
        isAlreadyRead: true,
        completedDate: undefined,
        ensureReadingStatus: sessionService.ensureReadingStatus.bind(sessionService),
        create100PercentProgress: sessionService.create100PercentProgress.bind(sessionService),
        updateStatus: sessionService.updateStatus.bind(sessionService),
        invalidateCache: (sessionService as any).invalidateCache.bind(sessionService),
        findMostRecentCompletedSession: sessionService.findMostRecentCompletedSession.bind(sessionService),
        sessionRepository,
        logger,
      };

      const result = await (sessionService as any).alreadyReadStrategy(context);

      expect(result.sessionId).toBe(mostRecent.id);
    });
  });
});
