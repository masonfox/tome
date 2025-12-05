/**
 * Session Importer Service
 * 
 * Handles import execution: creates reading sessions, detects duplicates, 
 * and syncs ratings to Calibre.
 * 
 * Note: Progress logs are NOT created for imports. Progress logs track daily
 * reading journeys (page-by-page progression), while imports only have
 * historical completion dates. Creating progress logs would artificially
 * inflate streak calculations. Session completedDate preserves history.
 */

import { sessionRepository } from '@/lib/repositories/session.repository';
import { bookRepository } from '@/lib/repositories/book.repository';
import type { Book } from '@/lib/db/schema/books';
import type { ImportRecord } from './csv-parser.service';
import type { MatchResult } from './book-matcher.service';
import { getLogger } from '@/lib/logger';
import { updateCalibreRating } from '@/lib/db/calibre-write';

const logger = getLogger();

/**
 * Session import result for a single record
 */
export interface SessionImportResult {
  rowNumber: number;
  bookId: number;
  bookTitle: string;
  action: 'created' | 'skipped' | 'failed';
  reason: string;
  sessionId?: number;
  sessionNumber?: number;
  isDuplicate?: boolean;
  error?: string;
}

/**
 * Import execution summary
 */
export interface ImportExecutionSummary {
  totalRecords: number;
  sessionsCreated: number;
  sessionsSkipped: number;
  duplicatesFound: number;
  ratingsUpdated: number;
  calibreSyncFailures: number;
  errors: Array<{ rowNumber: number; error: string }>;
}

/**
 * Status mapping from import to session status
 */
function mapImportStatus(
  importStatus: ImportRecord['status']
): 'to-read' | 'reading' | 'read' {
  switch (importStatus) {
    case 'read':
      return 'read';
    case 'currently-reading':
      return 'reading';
    case 'to-read':
      return 'to-read';
    default:
      // DNF and paused default to to-read
      return 'to-read';
  }
}

class SessionImporterService {
  /**
   * Determines if we should update the existing session vs creating a new one.
   *
   * Rules:
   * - If existing session is 'read' (completed), always create new (re-read scenario)
   * - Otherwise, update existing session to new status (status progression)
   */
  private shouldUpdateExisting(
    existingStatus: string,
    importStatus: string
  ): boolean {
    // If the existing session is already completed, this is a re-read
    if (existingStatus === 'read') {
      return false; // Create new session
    }

    // Otherwise, this is a status progression - update existing
    return true;
  }

  /**
   * Import sessions from matched records
   * Processes in batch with transaction safety
   */
  async importSessions(
    matches: MatchResult[],
    options: {
      skipDuplicates?: boolean;
    } = {}
  ): Promise<ImportExecutionSummary> {
    const summary: ImportExecutionSummary = {
      totalRecords: matches.length,
      sessionsCreated: 0,
      sessionsSkipped: 0,
      duplicatesFound: 0,
      ratingsUpdated: 0,
      calibreSyncFailures: 0,
      errors: [],
    };

    const { skipDuplicates = true } = options;

    logger.info(
      {
        totalRecords: matches.length,
        skipDuplicates,
      },
      'Starting session import'
    );

    // Process each match
    for (const match of matches) {
      if (!match.matchedBook) {
        // Skip unmatched records (handled separately)
        summary.sessionsSkipped++;
        continue;
      }

      try {
        const result = await this.importSingleSession(
          match.importRecord,
          match.matchedBook,
          { skipDuplicates }
        );

        if (result.action === 'created') {
          summary.sessionsCreated++;
        } else if (result.action === 'skipped') {
          summary.sessionsSkipped++;
          if (result.isDuplicate) {
            summary.duplicatesFound++;
          }
        }
      } catch (error: any) {
        summary.errors.push({
          rowNumber: match.importRecord.rowNumber,
          error: error.message || 'Unknown error',
        });
        logger.error(
          {
            err: error,
            errorMessage: error.message,
            errorStack: error.stack,
            rowNumber: match.importRecord.rowNumber,
            bookId: match.matchedBook.id,
            bookTitle: match.matchedBook.title,
            importRecordData: {
              status: match.importRecord.status,
              startedDate: match.importRecord.startedDate,
              startedDateType: typeof match.importRecord.startedDate,
              completedDate: match.importRecord.completedDate,
              completedDateType: typeof match.importRecord.completedDate,
              rating: match.importRecord.rating,
              review: match.importRecord.review?.substring(0, 50),
            },
          },
          'Failed to import session'
        );
      }
    }

    // Sync ratings to Calibre (after all sessions created)
    const ratingResults = await this.syncRatingsToCalibre(matches);
    summary.ratingsUpdated = ratingResults.updated;
    summary.calibreSyncFailures = ratingResults.failures;

    // Note: We do NOT create progress logs for imports
    // Rationale: Progress logs track daily reading progression (the journey)
    // Imports only have completion dates (no daily granularity)
    // Creating progress logs would artificially inflate streak calculations
    // Session completedDate already preserves "when finished"

    logger.info(summary, 'Session import completed');

    return summary;
  }

  /**
   * Import a single session
   */
  private async importSingleSession(
    record: ImportRecord,
    book: Book,
    options: { skipDuplicates: boolean }
  ): Promise<SessionImportResult> {
    const { skipDuplicates } = options;

    // Helper to ensure we have a Date object (not a string) - defined at start for use throughout
    const ensureDate = (value: any): Date | null => {
      if (!value) return null;
      if (value instanceof Date) return value;
      if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      }
      return null;
    };

    // Skip DNF records entirely
    if (record.status === 'did-not-finish') {
      return {
        rowNumber: record.rowNumber,
        bookId: book.id,
        bookTitle: book.title,
        action: 'skipped',
        reason: 'Did not finish (DNF)',
      };
    }

    // Map import status to session status
    const sessionStatus = mapImportStatus(record.status);

    // Check for duplicates if enabled
    if (skipDuplicates) {
      // Convert completedDate to timestamp for duplicate check
      const completedDateForDuplicateCheck = record.completedDate 
        ? ensureDate(record.completedDate)
        : null;
      
      const duplicate = await sessionRepository.findDuplicate(
        book.id,
        sessionStatus,
        completedDateForDuplicateCheck,
        record.rating || null
      );

      if (duplicate) {
        logger.debug(
          {
            bookId: book.id,
            existingSessionId: duplicate.id,
            rowNumber: record.rowNumber,
          },
          'Duplicate session found, skipping'
        );

        return {
          rowNumber: record.rowNumber,
          bookId: book.id,
          bookTitle: book.title,
          action: 'skipped',
          reason: 'Duplicate session exists',
          isDuplicate: true,
          sessionId: duplicate.id,
        };
      }
    }

    // Determine dates based on status and available data
    let startedDate: Date | null = null;
    let completedDate: Date | null = null;

    if (sessionStatus === 'read' && record.completedDate) {
      // For completed reads: use startedDate and completedDate from import if available
      startedDate = ensureDate(record.startedDate);
      completedDate = ensureDate(record.completedDate);
    } else if (sessionStatus === 'reading') {
      // For currently-reading: use startedDate from import, or fall back to completedDate or now
      const recordStartedDate = ensureDate(record.startedDate);
      const recordCompletedDate = ensureDate(record.completedDate);
      startedDate = recordStartedDate || recordCompletedDate || new Date();
      completedDate = null;
    }
    // For 'to-read': both dates remain null

    // Convert Date objects to Unix timestamps for intermediate processing
    const convertToTimestamp = (date: Date | null): number | null => {
      if (!date) return null;
      if (typeof date === 'number') return date; // Already a timestamp
      if (date instanceof Date) return Math.floor(date.getTime() / 1000);
      if (typeof date === 'string') {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime()) ? Math.floor(parsed.getTime() / 1000) : null;
      }
      return null;
    };

    const startedDateTs = convertToTimestamp(startedDate);
    const completedDateTs = convertToTimestamp(completedDate);

    // Convert timestamps back to Date objects for Drizzle
    // Drizzle's mode: "timestamp" expects Date objects, which it converts to timestamps internally
    const startedDateForDb = startedDateTs ? new Date(startedDateTs * 1000) : null;
    const completedDateForDb = completedDateTs ? new Date(completedDateTs * 1000) : null;

    // Check for existing active session
    const activeSession = await sessionRepository.findActiveByBookId(book.id);
    let session;
    let sessionNumber;
    let wasUpdated = false;

    if (activeSession && this.shouldUpdateExisting(activeSession.status, sessionStatus)) {
      // Update existing session (status progression)
      logger.debug(
        {
          bookId: book.id,
          sessionId: activeSession.id,
          oldStatus: activeSession.status,
          newStatus: sessionStatus,
        },
        'Updating existing session with import data'
      );

      // Prepare update data
      const updateData: any = {
        status: sessionStatus,
        isActive: sessionStatus !== 'read',
      };

      // Update dates if provided by import
      if (startedDateForDb) {
        updateData.startedDate = startedDateForDb;
      }
      if (completedDateForDb) {
        updateData.completedDate = completedDateForDb;
      }

      // Merge reviews (keep existing if import doesn't have one)
      if (record.review) {
        updateData.review = record.review;
      }

      session = await sessionRepository.update(activeSession.id, updateData);
      
      if (!session) {
        throw new Error(`Failed to update session ${activeSession.id}`);
      }
      
      sessionNumber = activeSession.sessionNumber;
      wasUpdated = true;

      logger.info(
        {
          sessionId: session.id,
          bookId: book.id,
          sessionNumber,
          status: sessionStatus,
          oldStatus: activeSession.status,
        },
        'Session updated'
      );
    } else {
      // Create new session (first read or re-read)
      sessionNumber = await sessionRepository.getNextSessionNumber(book.id);

      // Archive previous active session if this is a re-read
      if (activeSession && (sessionStatus === 'read' || sessionStatus === 'reading')) {
        await sessionRepository.archive(activeSession.id);
        logger.debug(
          {
            bookId: book.id,
            archivedSessionId: activeSession.id,
          },
          'Archived previous active session for re-read'
        );
      }

      session = await sessionRepository.create({
        userId: null, // Single-user mode
        bookId: book.id,
        sessionNumber,
        status: sessionStatus,
        startedDate: startedDateForDb,
        completedDate: completedDateForDb,
        review: record.review,
        isActive: sessionStatus !== 'read', // Completed reads are archived
      });

      logger.info(
        {
          sessionId: session.id,
          bookId: book.id,
          sessionNumber,
          status: sessionStatus,
        },
        'Session created'
      );
    }

    // Update book rating if provided
    if (record.rating && record.rating > 0) {
      await bookRepository.update(book.id, { rating: record.rating });
    }

    return {
      rowNumber: record.rowNumber,
      bookId: book.id,
      bookTitle: book.title,
      action: 'created',
      reason: wasUpdated ? 'Session updated successfully' : 'Session created successfully',
      sessionId: session.id,
      sessionNumber,
    };
  }

  /**
   * Sync ratings to Calibre (best-effort)
   * Updates both Tome database and Calibre database
   * Calibre sync failures are logged but don't fail the import
   */
  private async syncRatingsToCalibre(matches: MatchResult[]): Promise<{
    updated: number;
    failures: number;
  }> {
    let updated = 0;
    let failures = 0;

    for (const match of matches) {
      if (!match.matchedBook || !match.importRecord.rating || match.importRecord.rating <= 0) {
        continue;
      }

      const { matchedBook, importRecord } = match;

      try {
        // Update book rating in Tome database
        await bookRepository.update(matchedBook.id, {
          rating: importRecord.rating,
        });

        // Sync rating to Calibre (best-effort)
        try {
          if (matchedBook.calibreId) {
            updateCalibreRating(matchedBook.calibreId, importRecord.rating ?? null);
          }
        } catch (calibreError: any) {
          // Log Calibre sync failure but don't fail the import
          logger.warn(
            {
              err: calibreError,
              bookId: matchedBook.id,
              calibreId: matchedBook.calibreId,
              rating: importRecord.rating,
            },
            'Failed to sync rating to Calibre (non-fatal)'
          );
        }

        updated++;
        logger.debug(
          {
            bookId: matchedBook.id,
            calibreId: matchedBook.calibreId,
            rating: importRecord.rating,
          },
          'Rating updated in Tome database and synced to Calibre'
        );
      } catch (error: any) {
        failures++;
        logger.warn(
          {
            err: error,
            bookId: matchedBook.id,
            rating: importRecord.rating,
          },
          'Failed to update rating (non-fatal)'
        );
      }
    }

    return { updated, failures };
  }

  /**
   * Handle re-reads (multiple completed dates for same book)
   * Creates sequential sessions with incrementing session numbers
   */
  async handleReReads(
    book: Book,
    completedDates: Date[],
    rating?: number,
    review?: string
  ): Promise<number[]> {
    const sessionIds: number[] = [];

    // Filter out invalid dates and sort chronologically
    const validDates = completedDates.filter(d => d && d instanceof Date && !isNaN(d.getTime()));
    const sortedDates = [...validDates].sort((a, b) => a.getTime() - b.getTime());

    for (const date of sortedDates) {
      const sessionNumber = await sessionRepository.getNextSessionNumber(book.id);

      // Convert Date to timestamp for SQLite
      const dateTs = Math.floor(date.getTime() / 1000);

      const session = await sessionRepository.create({
        userId: null,
        bookId: book.id,
        sessionNumber,
        status: 'read',
        startedDate: dateTs as any, // Cast to any - Drizzle types expect Date but SQLite needs number
        completedDate: dateTs as any,
        review,
        isActive: false, // Re-reads are archived
      });

      sessionIds.push(session.id);

      logger.debug(
        {
          sessionId: session.id,
          bookId: book.id,
          sessionNumber,
          completedDate: date,
        },
        'Re-read session created'
      );
    }

    return sessionIds;
  }
}

// Export class for testing
export { SessionImporterService };

// Singleton instance
export const sessionImporterService = new SessionImporterService();
