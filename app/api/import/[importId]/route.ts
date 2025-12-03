/**
 * Import Preview API Route
 * GET /api/import/[importId]/preview
 * 
 * Returns paginated preview of import match results for review
 */

import { NextRequest, NextResponse } from 'next/server';
import { importPreviewService } from '@/lib/services/import-preview.service';
import { MatchConfidence } from '@/lib/services/book-matcher.service';
import { getLogger } from '@/lib/logger';

const logger = getLogger();

// Maximum pagination limit
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 500;

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
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10),
      MAX_LIMIT
    );

    // Parse confidence filter
    const confidenceParam = searchParams.get('confidence');
    let confidenceFilter: MatchConfidence[] | undefined;
    
    if (confidenceParam) {
      const confidenceLevels = confidenceParam.split(',') as MatchConfidence[];
      const validLevels: MatchConfidence[] = ['exact', 'high', 'medium', 'low', 'unmatched'];
      
      // Validate confidence levels
      const invalidLevels = confidenceLevels.filter(
        level => !validLevels.includes(level)
      );
      
      if (invalidLevels.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid confidence filter',
            details: `Invalid confidence levels: ${invalidLevels.join(', ')}. Valid levels: ${validLevels.join(', ')}`,
            code: 'INVALID_CONFIDENCE_FILTER',
          },
          { status: 400 }
        );
      }

      confidenceFilter = confidenceLevels;
    }

    // Validate pagination parameters
    if (offset < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid offset',
          details: 'Offset must be >= 0',
          code: 'INVALID_OFFSET',
        },
        { status: 400 }
      );
    }

    if (limit <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid limit',
          details: `Limit must be between 1 and ${MAX_LIMIT}`,
          code: 'INVALID_LIMIT',
        },
        { status: 400 }
      );
    }

    logger.info(
      {
        importId,
        offset,
        limit,
        confidenceFilter,
      },
      'Fetching import preview'
    );

    // Get preview from cache
    const preview = importPreviewService.getPreview(importId, {
      offset,
      limit,
      confidence: confidenceFilter,
    });

    if (!preview) {
      logger.warn(
        {
          importId,
        },
        'Import preview not found in cache'
      );

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

    logger.info(
      {
        importId,
        totalRecords: preview.summary.totalRecords,
        matched: preview.summary.matched,
        itemsReturned: preview.items.length,
      },
      'Import preview retrieved'
    );

    // Return preview
    return NextResponse.json(
      {
        success: true,
        data: preview,
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(
      {
        err: error,
        importId: params.importId,
      },
      'Import preview failed'
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message || 'Failed to retrieve import preview',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
