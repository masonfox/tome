import { koreaderMappingRepository } from '@/lib/repositories/koreader-mapping.repository';
import { bookRepository } from '@/lib/repositories/book.repository';
import { progressRepository } from '@/lib/repositories/progress.repository';
import { sessionRepository } from '@/lib/repositories/session.repository';
import { settingsRepository } from '@/lib/repositories/settings.repository';
import { getLogger } from '@/lib/logger';
import { toDateString } from '@/utils/dateHelpers.server';

const logger = getLogger().child({ module: 'koreader-progress' });

/**
 * Progress data from KoReader sync request
 */
export interface ProgressData {
  documentHash: string;
  percentage: number;      // 0.0 to 1.0 (KoReader format)
  progress: string;        // Text progress position (optional metadata)
  device: string;          // Device name/ID
  username?: string;       // KoReader username (optional)
}

/**
 * KoReader Progress Service
 * 
 * Processes progress updates from KoReader sync requests and creates
 * corresponding progress logs in Tome. This runs asynchronously after
 * forwarding the request to upstream.
 */
export class KoReaderProgressService {
  /**
   * Process a progress update from KoReader
   * 
   * This is called asynchronously (fire-and-forget) from the proxy route.
   * It will NOT throw errors - all errors are logged and handled internally.
   * 
   * Workflow:
   * 1. Check if auto-progress logging is enabled
   * 2. Find document-to-book mapping
   * 3. Find or create active reading session
   * 4. Create progress log entry
   * 5. Auto-complete session if at 100%
   * 6. Update mapping last synced timestamp
   * 
   * @param data - Progress data from KoReader sync request
   */
  async processProgressUpdate(data: ProgressData): Promise<void> {
    try {
      // Check if auto-progress is enabled
      const autoProgress = await settingsRepository.getBoolean('koreader_auto_progress_log');
      if (!autoProgress) {
        logger.info('Auto progress log disabled, skipping');
        return;
      }
      
      // Find mapping for this document
      const mapping = await koreaderMappingRepository.findByDocumentHash(data.documentHash);
      
      if (!mapping) {
        logger.info({ documentHash: data.documentHash }, 'No mapping found for document, skipping progress log');
        // TODO: Queue for manual mapping UI (future enhancement)
        return;
      }
      
      // Get the mapped book
      const book = await bookRepository.findById(mapping.bookId);
      if (!book) {
        logger.warn({ 
          bookId: mapping.bookId, 
          documentHash: data.documentHash 
        }, 'Book not found for mapping');
        return;
      }
      
      // Find or create active reading session
      let session = await sessionRepository.findActiveByBookId(book.id);
      if (!session) {
        logger.info({ bookId: book.id }, 'No active session found, creating new session');
        const nextNumber = await sessionRepository.getNextSessionNumber(book.id);
        session = await sessionRepository.create({
          bookId: book.id,
          sessionNumber: nextNumber,
          status: 'reading',
          isActive: true,
        });
      }
      
      // Calculate current page if book has total pages
      let currentPage = 0;
      if (book.totalPages && book.totalPages > 0) {
        currentPage = Math.floor(data.percentage * book.totalPages);
      }
      
      // Convert percentage from 0-1 to 0-100 for storage
      const currentPercentage = data.percentage * 100;
      
      // Get today's date in YYYY-MM-DD format
      const progressDate = toDateString(new Date());
      
      // Create progress log with device info in notes
      await progressRepository.create({
        bookId: book.id,
        sessionId: session.id,
        currentPercentage,
        currentPage,
        progressDate,
        pagesRead: 0, // KoReader doesn't track pages read per log entry
        notes: `Synced from KoReader device: ${data.device}`,
      });
      
      logger.info({ 
        documentHash: data.documentHash, 
        bookId: book.id,
        sessionId: session.id,
        percentage: currentPercentage,
        device: data.device
      }, 'Progress log created from KoReader sync');
      
      // Update mapping last synced timestamp
      await koreaderMappingRepository.updateLastSynced(data.documentHash, new Date());
      
      // Auto-complete session at 100%
      if (data.percentage >= 1.0 && session.status !== 'read') {
        await sessionRepository.update(session.id, {
          status: 'read',
          completedDate: progressDate,
        });
        logger.info({ 
          sessionId: session.id, 
          bookId: book.id 
        }, 'Session auto-completed at 100%');
      }
      
    } catch (error) {
      logger.error({ error, data }, 'Failed to process progress update');
      // Don't throw - this is async fire-and-forget, shouldn't block proxy response
    }
  }
}

export const koReaderProgressService = new KoReaderProgressService();
