/**
 * Import Unmatched Records API Route
 * GET /api/import/[importId]/unmatched
 * 
 * Returns unmatched records from an import in JSON or CSV format
 */

import { NextRequest, NextResponse } from 'next/server';
import { importLogRepository } from '@/lib/repositories/import-log.repository';
import { importUnmatchedRecordRepository } from '@/lib/repositories/import-unmatched-record.repository';
import { getLogger } from '@/lib/logger';
import { stringify } from 'csv-stringify/sync';

const logger = getLogger();

type MatchReason =
  | 'no_isbn'
  | 'isbn_not_found'
  | 'no_title_match'
  | 'ambiguous_match'
  | 'not_in_library'
  | 'invalid_data';

export async function GET(
  request: NextRequest,
  { params }: { params: { importId: string } }
) {
  try {
    const importId = parseInt(params.importId, 10);

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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';
    const reasonParam = searchParams.get('reason');

    // Validate format
    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid format',
          details: 'Format must be either "json" or "csv"',
          code: 'INVALID_FORMAT',
        },
        { status: 400 }
      );
    }

    // Validate reason filter if provided
    let reasonFilter: MatchReason | undefined;
    if (reasonParam) {
      const validReasons: MatchReason[] = [
        'no_isbn',
        'isbn_not_found',
        'no_title_match',
        'ambiguous_match',
        'not_in_library',
        'invalid_data',
      ];

      if (!validReasons.includes(reasonParam as MatchReason)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid reason filter',
            details: `Reason must be one of: ${validReasons.join(', ')}`,
            code: 'INVALID_REASON',
          },
          { status: 400 }
        );
      }

      reasonFilter = reasonParam as MatchReason;
    }

    logger.info(
      {
        importId,
        format,
        reasonFilter,
      },
      'Fetching unmatched records'
    );

    // Get import log
    const importLog = await importLogRepository.findById(importId);
    if (!importLog) {
      return NextResponse.json(
        {
          success: false,
          error: 'Import not found',
          code: 'IMPORT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Get unmatched records
    let unmatchedRecords;
    if (reasonFilter) {
      unmatchedRecords = await importUnmatchedRecordRepository.findByImportLogIdAndReason(
        importId,
        reasonFilter
      );
    } else {
      unmatchedRecords = await importUnmatchedRecordRepository.findByImportLogId(importId);
    }

    logger.info(
      {
        importId,
        unmatchedCount: unmatchedRecords.length,
        reasonFilter,
      },
      'Unmatched records retrieved'
    );

    // Return CSV format
    if (format === 'csv') {
      const csvData = generateCSV(unmatchedRecords);
      
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="unmatched-records-${importId}.csv"`,
        },
      });
    }

    // Return JSON format
    return NextResponse.json(
      {
        success: true,
        data: {
          importId,
          fileName: importLog.fileName,
          provider: importLog.provider,
          totalUnmatched: unmatchedRecords.length,
          records: unmatchedRecords.map(record => ({
            id: record.id,
            title: record.title,
            authors: record.authors,
            isbn: record.isbn,
            isbn13: record.isbn13,
            rating: record.rating,
            completedDate: record.completedDate,
            status: record.status,
            review: record.review,
            matchReason: record.matchReason,
            confidence: record.confidence,
            createdAt: record.createdAt,
          })),
          reasonBreakdown: await importUnmatchedRecordRepository.getMatchReasonStats(importId),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(
      {
        err: error,
        importId: params.importId,
      },
      'Failed to retrieve unmatched records'
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message || 'Failed to retrieve unmatched records',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV from unmatched records
 */
function generateCSV(records: any[]): string {
  if (records.length === 0) {
    return 'Title,Authors,ISBN,ISBN13,Rating,Completed Date,Status,Review,Match Reason,Confidence\n';
  }

  const csvRows = records.map(record => ({
    Title: record.title,
    Authors: Array.isArray(record.authors) ? record.authors.join('; ') : record.authors,
    ISBN: record.isbn || '',
    ISBN13: record.isbn13 || '',
    Rating: record.rating || '',
    'Completed Date': record.completedDate
      ? new Date(record.completedDate).toISOString().split('T')[0]
      : '',
    Status: record.status,
    Review: record.review || '',
    'Match Reason': formatMatchReason(record.matchReason),
    Confidence: record.confidence || '',
  }));

  return stringify(csvRows, {
    header: true,
    quoted: true,
  });
}

/**
 * Format match reason for display
 */
function formatMatchReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    no_isbn: 'No ISBN provided',
    isbn_not_found: 'ISBN not found in library',
    no_title_match: 'No title match found',
    ambiguous_match: 'Multiple possible matches',
    not_in_library: 'Book not in library',
    invalid_data: 'Invalid or incomplete data',
  };

  return reasonMap[reason] || reason;
}
