/**
 * Import Preview Service
 * Builds preview responses for import review UI
 */

import type { MatchResult, MatchConfidence } from './book-matcher.service';
import { importCache, CachedImportData } from './import-cache.service';
import { sessionRepository } from '@/lib/repositories/session.repository';

/**
 * Map import status to session status
 */
function mapImportStatusToSession(
  importStatus: 'read' | 'currently-reading' | 'to-read' | 'did-not-finish' | 'paused'
): 'to-read' | 'reading' | 'read' {
  switch (importStatus) {
    case 'read':
      return 'read';
    case 'currently-reading':
      return 'reading';
    case 'to-read':
      return 'to-read';
    default:
      return 'to-read';
  }
}

/**
 * Preview item for UI display
 */
export interface PreviewItem {
  rowNumber: number;
  importData: {
    title: string;
    authors: string[];
    isbn?: string;
    isbn13?: string;
    rating?: number;
    completedDate?: Date;
    status: string;
    review?: string;
    readCount?: number;
    totalPages?: number;
  };
  matchedBook: {
    id: number;
    title: string;
    authors: string[];
    isbn?: string;
  } | null;
  matchReason: string;
  confidence: MatchConfidence;
  confidenceScore: number;
  willCreateSession: boolean;
  isDuplicate: boolean;
  warnings: string[];
}

/**
 * Preview response with pagination
 */
export interface PreviewResponse {
  importId: number;
  fileName: string;
  provider: 'goodreads' | 'storygraph';
  summary: {
    totalRecords: number;
    matched: number;
    unmatched: number;
    exactMatches: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
    lowConfidenceMatches: number;
  };
  items: PreviewItem[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Preview filter options
 */
export interface PreviewFilters {
  confidence?: MatchConfidence[];
  offset?: number;
  limit?: number;
}

class ImportPreviewService {
  /**
   * Build preview response from cached data
   */
  async buildPreview(
    cachedData: CachedImportData,
    filters: PreviewFilters = {}
  ): Promise<PreviewResponse> {
    const { offset = 0, limit = 500, confidence } = filters;
    
    // Apply confidence filter if provided
    let filteredResults = cachedData.matchResults;
    if (confidence && confidence.length > 0) {
      filteredResults = filteredResults.filter(result =>
        confidence.includes(result.confidence)
      );
    }

    // Calculate summary stats
    const summary = this.calculateSummary(cachedData.matchResults);

    // Apply pagination
    const total = filteredResults.length;
    const paginatedResults = filteredResults.slice(offset, offset + limit);

    // Build preview items
    const items = await Promise.all(
      paginatedResults.map(result => this.buildPreviewItem(result))
    );

    return {
      importId: cachedData.importId,
      fileName: cachedData.fileName,
      provider: cachedData.provider,
      summary,
      items,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Build a single preview item
   */
  private async buildPreviewItem(matchResult: MatchResult): Promise<PreviewItem> {
    const { importRecord, matchedBook, confidence, confidenceScore, matchReason } = matchResult;
    
    const warnings: string[] = [];
    
    // Check for potential issues
    if (matchedBook && importRecord.rating && importRecord.rating > 0) {
      warnings.push('Will update book rating');
    }
    
    if (importRecord.status === 'did-not-finish') {
      warnings.push('Book marked as Did Not Finish (DNF)');
    }

    if (confidence === 'low' || confidence === 'medium') {
      warnings.push('Review match accuracy before importing');
    }

    // Check for duplicate session
    let isDuplicate = false;
    if (matchedBook) {
      const sessionStatus = mapImportStatusToSession(importRecord.status);
      const existingSession = await sessionRepository.findDuplicate(
        matchedBook.id,
        sessionStatus,
        importRecord.completedDate || null,
        importRecord.rating || null
      );
      
      if (existingSession) {
        isDuplicate = true;
        warnings.push('Duplicate session exists - will be skipped');
      }
    }

    // Determine if this will create a new session
    const willCreateSession = matchedBook !== null && 
                              !isDuplicate &&
                              importRecord.status === 'read' && 
                              importRecord.completedDate !== undefined;

    return {
      rowNumber: importRecord.rowNumber,
      importData: {
        title: importRecord.title,
        authors: importRecord.authors,
        isbn: importRecord.isbn,
        isbn13: importRecord.isbn13,
        rating: importRecord.rating,
        completedDate: importRecord.completedDate,
        status: importRecord.status,
        review: importRecord.review,
        readCount: importRecord.readCount,
        totalPages: importRecord.totalPages,
      },
      matchedBook: matchedBook ? {
        id: matchedBook.id,
        title: matchedBook.title,
        authors: matchedBook.authors,
        isbn: matchedBook.isbn || undefined,
      } : null,
      matchReason: this.formatMatchReason(matchReason),
      confidence,
      confidenceScore,
      willCreateSession,
      isDuplicate: false, // TODO: Implement duplicate detection in Phase 6
      warnings,
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(matchResults: MatchResult[]) {
    const summary = {
      totalRecords: matchResults.length,
      matched: 0,
      unmatched: 0,
      exactMatches: 0,
      highConfidenceMatches: 0,
      mediumConfidenceMatches: 0,
      lowConfidenceMatches: 0,
    };

    matchResults.forEach(result => {
      if (result.matchedBook) {
        summary.matched++;
        
        switch (result.confidence) {
          case 'exact':
            summary.exactMatches++;
            break;
          case 'high':
            summary.highConfidenceMatches++;
            break;
          case 'medium':
            summary.mediumConfidenceMatches++;
            break;
          case 'low':
            summary.lowConfidenceMatches++;
            break;
        }
      } else {
        summary.unmatched++;
      }
    });

    return summary;
  }

  /**
   * Format match reason for display
   */
  private formatMatchReason(matchReason: string): string {
    const reasonMap: Record<string, string> = {
      isbn_match: 'Exact ISBN match',
      title_author_exact: 'Exact title and author match',
      title_author_high: 'High confidence title and author match',
      title_author_medium: 'Medium confidence title and author match',
      title_fuzzy: 'Fuzzy title match',
      no_match: 'No matching book found in library',
    };

    return reasonMap[matchReason] || matchReason;
  }

  /**
   * Get preview from cache by importId
   */
  async getPreview(
    importId: number,
    filters: PreviewFilters = {}
  ): Promise<PreviewResponse | null> {
    const cachedData = importCache.get(importId);
    
    if (!cachedData) {
      return null;
    }

    return await this.buildPreview(cachedData, filters);
  }
}

// Singleton instance
export const importPreviewService = new ImportPreviewService();
