/**
 * Session Importer Service
 * 
 * Handles import execution: creates reading sessions, detects duplicates, 
 * syncs ratings to Calibre, and creates progress logs
 */

import { sessionRepository } from '@/lib/repositories/session.repository';
import { progressRepository } from '@/lib/repositories/progress.repository';
import { bookRepository } from '@/lib/repositories/book.repository';
import type { Book } from '@/lib/db/schema/books';
import type { ImportRecord } from './csv-parser.service';
import type { MatchResult } from './book-matcher.service';
import { getLogger } from '@/lib/logger';

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
  progressLogsCreated: number;
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
      progressLogsCreated: 0,
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

    // Create progress logs for completed sessions
    try {
      summary.progressLogsCreated = await this.createProgressLogs();
    } catch (error: any) {
      logger.error({
        err: error,
        errorMessage: error.message,
        errorStack: error.stack,
      }, 'Failed to create progress logs (non-fatal)');
      summary.progressLogsCreated = 0;
      // Don't fail the entire import if progress log creation fails
    }

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

    // Get next session number
    const sessionNumber = await sessionRepository.getNextSessionNumber(book.id);

    // Archive existing active session if this is a new read
    if (sessionStatus === 'read' || sessionStatus === 'reading') {
      const activeSession = await sessionRepository.findActiveByBookId(book.id);
      if (activeSession) {
        await sessionRepository.archive(activeSession.id);
        logger.debug(
          {
            bookId: book.id,
            archivedSessionId: activeSession.id,
          },
          'Archived previous active session'
        );
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
    
    const session = await sessionRepository.create({
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

    // Update book rating if provided
    if (record.rating && record.rating > 0) {
      await bookRepository.update(book.id, { rating: record.rating });
    }

    return {
      rowNumber: record.rowNumber,
      bookId: book.id,
      bookTitle: book.title,
      action: 'created',
      reason: 'Session created successfully',
      sessionId: session.id,
      sessionNumber,
    };
  }

  /**
   * Sync ratings to Calibre (best-effort)
   * Note: Calibre DB is read-only, so we only update ratings in Tome database
   * Ratings sync back to Calibre happens via Calibre's own sync mechanisms
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
        // Calibre DB is read-only, ratings sync via Calibre's own mechanisms
        await bookRepository.update(matchedBook.id, {
          rating: importRecord.rating,
        });

        updated++;
        logger.debug(
          {
            bookId: matchedBook.id,
            calibreId: matchedBook.calibreId,
            rating: importRecord.rating,
          },
          'Rating updated in Tome database'
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
   * Create progress logs for all completed sessions without progress
   * Creates 100% progress entry for each "read" session
   */
  private async createProgressLogs(): Promise<number> {
    let created = 0;

    // Find all completed sessions
    const completedSessions = await sessionRepository.findByStatus('read', false);

    for (const session of completedSessions) {
      try {
        // Check if session already has progress
        const hasProgress = await progressRepository.hasProgressForSession(session.id);
        if (hasProgress) {
          continue;
        }

        // Get book details for page count
        const book = await bookRepository.findById(session.bookId);
        if (!book) {
          logger.warn({ sessionId: session.id }, 'Book not found for session, skipping progress log');
          continue;
        }

        // Create 100% progress log
        // Convert date to timestamp - session dates come back as Date objects from DB
        const progressDate = session.completedDate || session.createdAt;
        
        let progressDateTs: number;
        if (progressDate instanceof Date) {
          progressDateTs = Math.floor(progressDate.getTime() / 1000);
        } else if (typeof progressDate === 'number') {
          // Already a timestamp
          progressDateTs = progressDate;
        } else if (typeof progressDate === 'string') {
          // Try to parse as date string
          const parsedDate = new Date(progressDate);
          if (!isNaN(parsedDate.getTime())) {
            progressDateTs = Math.floor(parsedDate.getTime() / 1000);
          } else {
            logger.warn({ sessionId: session.id, progressDate }, 'Invalid progress date, using current time');
            progressDateTs = Math.floor(Date.now() / 1000);
          }
        } else {
          logger.warn({ 
            sessionId: session.id, 
            progressDate, 
            progressDateType: typeof progressDate,
            completedDate: session.completedDate,
            completedDateType: typeof session.completedDate,
            createdAt: session.createdAt,
            createdAtType: typeof session.createdAt
          }, 'Unknown progress date type, using current time');
          progressDateTs = Math.floor(Date.now() / 1000);
        }
        
        // Convert timestamp to Date object for Drizzle
        const progressDateForDb = new Date(progressDateTs * 1000);
        
        await progressRepository.create({
          userId: null, // Single-user mode
          bookId: session.bookId,
          sessionId: session.id,
          currentPage: book.totalPages || 0,
          pagesRead: book.totalPages || 0,
          currentPercentage: 100,
          progressDate: progressDateForDb,
          notes: 'Imported from reading history',
        });

        created++;
      } catch (error: any) {
        logger.error({
          err: error,
          errorMessage: error.message,
          errorStack: error.stack,
          sessionId: session.id,
          sessionData: {
            completedDate: session.completedDate,
            completedDateType: typeof session.completedDate,
            createdAt: session.createdAt,
            createdAtType: typeof session.createdAt,
          }
        }, 'Failed to create progress log for session');
        // Continue with next session instead of failing entire import
      }
    }

    logger.info({ progressLogsCreated: created }, 'Progress logs created');

    return created;
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

// Singleton instance
export const sessionImporterService = new SessionImporterService();
