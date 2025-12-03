/**
 * Import Execute API Route
 * POST /api/import/[importId]/execute
 * 
 * Executes the import: creates sessions, syncs ratings, stores unmatched records
 */

import { NextRequest, NextResponse } from 'next/server';
import { importCache } from '@/lib/services/import-cache.service';
import { sessionImporterService } from '@/lib/services/session-importer.service';
import { importLogRepository } from '@/lib/repositories/import-log.repository';
import { importUnmatchedRecordRepository } from '@/lib/repositories/import-unmatched-record.repository';
import type { ImportRecord } from '@/lib/services/csv-parser.service';
import type { MatchResult } from '@/lib/services/book-matcher.service';
import { getLogger } from '@/lib/logger';

const logger = getLogger();

// Batch size for transaction processing
const BATCH_SIZE = 100;

export async function POST(
  request: NextRequest,
  { params }: { params: { importId: string } }
) {
  const startTime = Date.now();
  const importId = parseInt(params.importId, 10);

  try {
    // Validate importId
    if (isNaN(importId) || importId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid import ID',
          code: 'INVALID_IMPORT_ID',
        },
        { status: 400 }
      );
    }

    logger.info({ importId }, 'Import execution started');

    // Get cached import data
    const cachedData = importCache.get(importId);
    
    if (!cachedData) {
      logger.warn({ importId }, 'Import not found in cache');
      
      return NextResponse.json(
        {
          success: false,
          error: 'Import not found or expired',
          details: 'The import session has expired (30 min timeout) or does not exist. Please upload the file again.',
          code: 'IMPORT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Get import log
    const importLog = await importLogRepository.findById(importId);
    if (!importLog) {
      return NextResponse.json(
        {
          success: false,
          error: 'Import log not found',
          code: 'IMPORT_LOG_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Check if already executed
    if (importLog.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: 'Import already executed',
          details: `This import has already been executed with status: ${importLog.status}`,
          code: 'IMPORT_ALREADY_EXECUTED',
        },
        { status: 400 }
      );
    }

    // Update import log to processing
    await importLogRepository.update(importId, {
      status: 'processing',
    });

    // Separate matched and unmatched records
    const matchedRecords = cachedData.matchResults.filter(
      result => result.matchedBook !== null
    );
    const unmatchedRecords = cachedData.matchResults.filter(
      result => result.matchedBook === null
    );

    logger.info(
      {
        importId,
        totalRecords: cachedData.matchResults.length,
        matched: matchedRecords.length,
        unmatched: unmatchedRecords.length,
      },
      'Processing import batches'
    );

    // Process matched records in batches
    const allSessions: any[] = [];
    let totalSessionsCreated = 0;
    let totalSessionsSkipped = 0;
    let totalDuplicates = 0;
    let totalRatingsUpdated = 0;
    let totalCalibreSyncFailures = 0;
    let totalProgressLogsCreated = 0;
    const allErrors: Array<{ rowNumber: number; error: string }> = [];

    // Process in batches to prevent timeouts
    for (let i = 0; i < matchedRecords.length; i += BATCH_SIZE) {
      const batch = matchedRecords.slice(i, i + BATCH_SIZE);
      
      logger.debug(
        {
          importId,
          batchStart: i,
          batchSize: batch.length,
        },
        'Processing batch'
      );

      try {
        // Import sessions for this batch
        const batchResult = await sessionImporterService.importSessions(batch, {
          skipDuplicates: true,
        });

        // Aggregate results
        totalSessionsCreated += batchResult.sessionsCreated;
        totalSessionsSkipped += batchResult.sessionsSkipped;
        totalDuplicates += batchResult.duplicatesFound;
        totalRatingsUpdated += batchResult.ratingsUpdated;
        totalCalibreSyncFailures += batchResult.calibreSyncFailures;
        totalProgressLogsCreated += batchResult.progressLogsCreated;
        allErrors.push(...batchResult.errors);
      } catch (error: any) {
        logger.error(
          {
            err: error,
            importId,
            batchStart: i,
          },
          'Batch processing failed'
        );

        // Mark as partial failure
        await importLogRepository.update(importId, {
          status: 'failed',
          completedAt: new Date(),
        });

        return NextResponse.json(
          {
            success: false,
            error: 'Import execution failed',
            details: error.message || 'Failed to process import batch',
            code: 'IMPORT_EXECUTION_FAILED',
          },
          { status: 500 }
        );
      }
    }

    // Store unmatched records
    let unmatchedCount = 0;
    if (unmatchedRecords.length > 0) {
      try {
        unmatchedCount = await storeUnmatchedRecords(
          importId,
          unmatchedRecords,
          cachedData.parsedRecords
        );
        
        logger.info(
          {
            importId,
            unmatchedCount,
          },
          'Unmatched records stored'
        );
      } catch (error: any) {
        logger.error(
          {
            err: error,
            importId,
          },
          'Failed to store unmatched records'
        );
      }
    }

    // Determine final status
    const finalStatus = allErrors.length > 0 ? 'partial' : 'success';
    const totalTimeMs = Date.now() - startTime;

    // Update import log with final statistics
    await importLogRepository.update(importId, {
      status: finalStatus,
      completedAt: new Date(),
      sessionsCreated: totalSessionsCreated,
      sessionsSkipped: totalSessionsSkipped,
      ratingsSync: totalRatingsUpdated,
      calibreSyncFailures: totalCalibreSyncFailures,
    });

    // Clear cache after successful execution
    importCache.delete(importId);

    logger.info(
      {
        importId,
        status: finalStatus,
        totalTimeMs,
        sessionsCreated: totalSessionsCreated,
        sessionsSkipped: totalSessionsSkipped,
        duplicatesFound: totalDuplicates,
        unmatchedCount,
      },
      'Import execution completed'
    );

    // Return execution summary
    return NextResponse.json(
      {
        success: true,
        data: {
          importId,
          status: finalStatus,
          summary: {
            totalRecords: cachedData.matchResults.length,
            matched: matchedRecords.length,
            unmatched: unmatchedCount,
            sessionsCreated: totalSessionsCreated,
            sessionsSkipped: totalSessionsSkipped,
            duplicatesFound: totalDuplicates,
            ratingsUpdated: totalRatingsUpdated,
            calibreSyncFailures: totalCalibreSyncFailures,
            progressLogsCreated: totalProgressLogsCreated,
            errors: allErrors.length,
          },
          executionTime: `${(totalTimeMs / 1000).toFixed(2)}s`,
          errors: allErrors.slice(0, 10), // Return first 10 errors only
          hasMoreErrors: allErrors.length > 10,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(
      {
        err: error,
        importId,
      },
      'Import execution failed'
    );

    // Update import log to failed
    try {
      await importLogRepository.update(importId, {
        status: 'failed',
        completedAt: new Date(),
      });
    } catch (logError) {
      logger.error({ err: logError }, 'Failed to update import log');
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message || 'Failed to execute import',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * Store unmatched records in database
 */
async function storeUnmatchedRecords(
  importLogId: number,
  unmatchedResults: MatchResult[],
  parsedRecords: ImportRecord[]
): Promise<number> {
  const recordsToStore = unmatchedResults.map(result => {
    const record = result.importRecord;
    const matchReason = determineUnmatchedReason(result);
    
    return {
      importLogId,
      title: record.title,
      authors: record.authors,
      isbn: record.isbn || null,
      isbn13: record.isbn13 || null,
      rating: record.rating || null,
      completedDate: record.completedDate || null,
      status: record.status,
      review: record.review || null,
      matchAttempted: true,
      matchReason: matchReason as "no_isbn" | "isbn_not_found" | "no_title_match" | "ambiguous_match" | "not_in_library" | "invalid_data",
      confidence: result.confidenceScore,
    };
  });

  // Bulk insert
  await importUnmatchedRecordRepository.bulkCreate(recordsToStore);

  return recordsToStore.length;
}

/**
 * Determine why a record didn't match
 */
function determineUnmatchedReason(result: MatchResult): string {
  const { importRecord, matchReason } = result;

  if (matchReason === 'no_match') {
    if (!importRecord.isbn && !importRecord.isbn13) {
      return 'no_isbn';
    }
    if (importRecord.isbn || importRecord.isbn13) {
      return 'isbn_not_found';
    }
    return 'no_title_match';
  }

  return matchReason;
}
