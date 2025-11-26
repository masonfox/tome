/**
 * Database seeding orchestrator
 * Syncs Calibre and generates realistic development data for testing
 */

import { syncCalibreLibrary } from "@/lib/sync-service";
import { bookRepository, sessionRepository, progressRepository } from "@/lib/repositories";
import { rebuildStreak } from "@/lib/streaks";
import { getLogger } from "@/lib/logger";
import {
  generateActiveStreak,
  generateHistoricalProgress,
  generateBookInProgress,
  generateCompletedBook,
} from "./fixtures/progress";

const logger = getLogger();

export interface SeedResult {
  success: boolean;
  booksFromSync: number;
  sessionsSeeded: number;
  progressLogsSeeded: number;
  booksUsed: number;
  currentStreak?: number;
  longestStreak?: number;
  totalDaysActive?: number;
  error?: string;
}

/**
 * Main seeding function
 * - Syncs Calibre library to import books
 * - Selects books from synced library
 * - Creates sessions and progress logs for realistic testing
 */
export async function seedDatabase(): Promise<SeedResult> {
  logger.info("Starting database seeding process...");

  try {
    // Phase 1: Sync Calibre
    logger.info("Phase 1: Syncing Calibre library...");
    const syncResult = await syncCalibreLibrary();

    if (!syncResult.success) {
      throw new Error(`Calibre sync failed: ${syncResult.error || "Unknown error"}`);
    }

    logger.info({
      synced: syncResult.syncedCount,
      updated: syncResult.updatedCount,
      removed: syncResult.removedCount,
      total: syncResult.totalBooks,
    }, "Calibre sync completed");

    if (syncResult.totalBooks === 0) {
      throw new Error("No books found in Calibre library. Please ensure CALIBRE_DB_PATH is set correctly.");
    }

    // Phase 2: Select books for seeding
    logger.info("Phase 2: Selecting books for seeding...");
    const allBooks = await bookRepository.findAll();

    if (allBooks.length === 0) {
      throw new Error("No books found in database after sync");
    }

    // Select 12 books with variety
    // We'll assign random page counts to any books without them
    const sortedBooks = allBooks.sort((a, b) => (a.totalPages || 200) - (b.totalPages || 200));
    const booksToUse = sortedBooks.slice(0, Math.min(12, sortedBooks.length));

    if (booksToUse.length === 0) {
      throw new Error("No books found to seed");
    }

    logger.info({
      totalBooks: allBooks.length,
      selectedBooks: booksToUse.length,
      titles: booksToUse.map(b => `${b.title} (${b.totalPages || 'no pages'})`),
    }, "Selected books for seeding");

    // Phase 3: Seed reading sessions
    logger.info("Phase 3: Creating reading sessions...");
    let sessionsCreated = 0;

    const sessionPlans = [
      { index: 0, status: "reading" as const, description: "active streak book 1", hasProgress: true },
      { index: 1, status: "reading" as const, description: "active streak book 2", hasProgress: true },
      { index: 2, status: "reading" as const, description: "mid-progress book", hasProgress: true },
      { index: 3, status: "reading" as const, description: "just started book", hasProgress: true },
      { index: 4, status: "read" as const, description: "completed book", hasProgress: true },
      { index: 5, status: "read-next" as const, description: "read-next book 1", hasProgress: false },
      { index: 6, status: "read-next" as const, description: "read-next book 2", hasProgress: false },
      { index: 7, status: "read-next" as const, description: "read-next book 3", hasProgress: false },
      { index: 8, status: "to-read" as const, description: "to-read book 1", hasProgress: false },
      { index: 9, status: "to-read" as const, description: "to-read book 2", hasProgress: false },
      { index: 10, status: "to-read" as const, description: "to-read book 3", hasProgress: false },
      { index: 11, status: "to-read" as const, description: "to-read book 4", hasProgress: false },
    ];

    const sessions: Array<{ bookId: number; sessionId: number; status: string; totalPages: number }> = [];

    for (const plan of sessionPlans) {
      if (plan.index >= booksToUse.length) continue;

      const book = booksToUse[plan.index];

      // Assign random page count if book doesn't have one
      let totalPages = book.totalPages;
      if (!totalPages || totalPages === 0) {
        // Generate realistic page count (150-600 pages)
        totalPages = Math.floor(Math.random() * 450) + 150;

        // Update book with generated page count
        await bookRepository.update(book.id, { totalPages });

        logger.info({
          bookId: book.id,
          title: book.title,
          generatedPages: totalPages
        }, "Assigned random page count to book");
      }

      // Check if book already has an active session
      const existingSession = await sessionRepository.findActiveByBookId(book.id);

      if (existingSession) {
        // Update session status if it doesn't match the plan
        if (existingSession.status !== plan.status) {
          await sessionRepository.update(existingSession.id, {
            status: plan.status,
            startedDate: plan.status !== "to-read" ? (existingSession.startedDate || new Date()) : null,
            completedDate: plan.status === "read" ? new Date() : existingSession.completedDate,
          });

          logger.info({
            bookId: book.id,
            title: book.title,
            sessionId: existingSession.id,
            oldStatus: existingSession.status,
            newStatus: plan.status,
          }, "Updated existing session status");
        } else {
          logger.info({
            bookId: book.id,
            title: book.title,
            sessionId: existingSession.id,
            status: existingSession.status,
          }, "Using existing session for book");
        }

        // Use existing session
        sessions.push({
          bookId: book.id,
          sessionId: existingSession.id,
          status: plan.status, // Use planned status (may have been updated)
          totalPages,
        });
        continue;
      }

      // Get next session number
      const sessionNumber = await sessionRepository.getNextSessionNumber(book.id);

      // Create session
      const session = await sessionRepository.create({
        bookId: book.id,
        sessionNumber,
        status: plan.status,
        startedDate: plan.status !== "to-read" ? new Date() : null,
        completedDate: plan.status === "read" ? new Date() : null,
      });

      sessions.push({
        bookId: book.id,
        sessionId: session.id,
        status: plan.status,
        totalPages,
      });

      sessionsCreated++;
      logger.info({
        bookId: book.id,
        title: book.title,
        status: plan.status,
        description: plan.description,
      }, "Created session");
    }

    // Phase 4: Seed progress logs
    logger.info("Phase 4: Generating progress logs...");
    let progressLogsCreated = 0;

    for (const session of sessions) {
      const logs: any[] = [];
      const sessionIndex = sessions.indexOf(session);
      const plan = sessionPlans[sessionIndex];

      // Only generate progress logs for sessions that should have them
      if (!plan || !plan.hasProgress) {
        continue;
      }

      // Generate progress based on session index
      if (sessionIndex === 0 || sessionIndex === 1) {
        // Active streak books - consecutive 7 days with 40+ pages/day
        const streakLogs = generateActiveStreak(
          session.bookId,
          session.sessionId,
          session.totalPages,
          7,
          sessionIndex === 0 ? Math.max(0, session.totalPages - 300) : Math.floor(session.totalPages * 0.4) // Nearly done for book 1, mid-progress for book 2
        );
        logs.push(...streakLogs);

        // Add historical progress before the streak
        if (session.totalPages > 300) {
          const historicalLogs = generateHistoricalProgress(
            session.bookId,
            session.sessionId,
            session.totalPages,
            3, // 3 months back
            sessionIndex === 0 ? 80 : 30 // Different starting points
          );
          logs.push(...historicalLogs);
        }
      } else if (sessionIndex === 2) {
        // Mid-progress book (40-60% complete)
        const midProgressLogs = generateBookInProgress(
          session.bookId,
          session.sessionId,
          session.totalPages,
          45 + Math.floor(Math.random() * 15), // 45-60%
          4 // 4 weeks
        );
        logs.push(...midProgressLogs);
      } else if (sessionIndex === 3) {
        // Just started (10-15% complete)
        const justStartedLogs = generateBookInProgress(
          session.bookId,
          session.sessionId,
          session.totalPages,
          10 + Math.floor(Math.random() * 6), // 10-15%
          2 // 2 weeks
        );
        logs.push(...justStartedLogs);
      } else if (sessionIndex === 4) {
        // Completed book - historical progress + completion log
        const completedHistorical = generateHistoricalProgress(
          session.bookId,
          session.sessionId,
          session.totalPages,
          2, // 2 months
          95 // Up to 95%
        );
        logs.push(...completedHistorical);

        const completionLog = generateCompletedBook(
          session.bookId,
          session.sessionId,
          session.totalPages,
          14 + Math.floor(Math.random() * 14) // 14-28 days ago
        );
        logs.push(completionLog);
      }
      // Other sessions: No progress logs (to-read, read-next scenarios)

      // Insert progress logs in batch
      if (logs.length > 0) {
        for (const log of logs) {
          await progressRepository.create(log);
        }

        progressLogsCreated += logs.length;
        logger.info({
          bookId: session.bookId,
          logsCreated: logs.length,
        }, "Created progress logs");
      }
    }

    // Phase 5: Rebuild streak from progress logs
    logger.info("Phase 5: Rebuilding streak from progress logs...");
    const rebuiltStreak = await rebuildStreak(null); // null for single-user mode
    
    logger.info({
      currentStreak: rebuiltStreak.currentStreak,
      longestStreak: rebuiltStreak.longestStreak,
      totalDaysActive: rebuiltStreak.totalDaysActive,
      lastActivityDate: rebuiltStreak.lastActivityDate,
    }, "Streak rebuilt successfully");

    logger.info({
      sessionsCreated,
      progressLogsCreated,
      currentStreak: rebuiltStreak.currentStreak,
    }, "Seeding completed successfully");

    return {
      success: true,
      booksFromSync: syncResult.totalBooks,
      sessionsSeeded: sessionsCreated,
      progressLogsSeeded: progressLogsCreated,
      booksUsed: booksToUse.length,
      currentStreak: rebuiltStreak.currentStreak,
      longestStreak: rebuiltStreak.longestStreak,
      totalDaysActive: rebuiltStreak.totalDaysActive,
    };
  } catch (error) {
    logger.error({ error }, "Seeding failed");
    return {
      success: false,
      booksFromSync: 0,
      sessionsSeeded: 0,
      progressLogsSeeded: 0,
      booksUsed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
