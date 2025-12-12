import { seriesRepository, SeriesInfo, SeriesBook } from "@/lib/repositories/series.repository";

/**
 * Custom error class for series-related operations
 */
export class SeriesError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'INVALID_INPUT' | 'DATABASE_ERROR',
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'SeriesError';
  }
}

/**
 * SeriesService - Business logic for series operations
 * Follows the three-tier architecture pattern
 */
export class SeriesService {
  /**
   * Get all series in the library
   * @returns Array of series with book counts
   */
  async getAllSeries(): Promise<SeriesInfo[]> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    try {
      logger.debug("[SeriesService] Fetching all series");
      const series = await seriesRepository.getAllSeries();
      logger.debug({ count: series.length }, "[SeriesService] Retrieved series");
      return series;
    } catch (error) {
      logger.error({ err: error }, "[SeriesService] Failed to get all series");
      throw new SeriesError(
        'Failed to retrieve series list',
        'DATABASE_ERROR',
        error
      );
    }
  }

  /**
   * Get all books in a specific series
   * @param seriesName - Name of the series
   * @returns Array of books in the series, ordered by series index
   * @throws {SeriesError} If series name is invalid or database error occurs
   */
  async getBooksBySeries(seriesName: string): Promise<SeriesBook[]> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    // Input validation
    if (!seriesName || typeof seriesName !== 'string') {
      logger.warn({ seriesName }, "[SeriesService] Invalid series name - empty or not a string");
      throw new SeriesError('Series name is required', 'INVALID_INPUT');
    }

    const trimmedName = seriesName.trim();
    if (trimmedName.length === 0) {
      logger.warn("[SeriesService] Invalid series name - whitespace only");
      throw new SeriesError('Series name cannot be empty', 'INVALID_INPUT');
    }

    if (trimmedName.length > 500) {
      logger.warn({ length: trimmedName.length }, "[SeriesService] Series name too long");
      throw new SeriesError('Series name is too long (max 500 characters)', 'INVALID_INPUT');
    }

    try {
      logger.debug({ seriesName: trimmedName }, "[SeriesService] Fetching books for series");
      const books = await seriesRepository.getBooksBySeries(trimmedName);
      logger.debug({ seriesName: trimmedName, count: books.length }, "[SeriesService] Retrieved books for series");
      return books;
    } catch (error) {
      if (error instanceof SeriesError) {
        throw error;
      }
      logger.error({ err: error, seriesName: trimmedName }, "[SeriesService] Failed to get books for series");
      throw new SeriesError(
        'Failed to retrieve books for series',
        'DATABASE_ERROR',
        error
      );
    }
  }

  /**
   * Get series information by name
   * @param seriesName - Name of the series
   * @returns Series info or null if not found
   * @throws {SeriesError} If series name is invalid or database error occurs
   */
  async getSeriesByName(seriesName: string): Promise<SeriesInfo | null> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    // Input validation
    if (!seriesName || typeof seriesName !== 'string') {
      logger.warn({ seriesName }, "[SeriesService] Invalid series name - empty or not a string");
      throw new SeriesError('Series name is required', 'INVALID_INPUT');
    }

    const trimmedName = seriesName.trim();
    if (trimmedName.length === 0) {
      logger.warn("[SeriesService] Invalid series name - whitespace only");
      throw new SeriesError('Series name cannot be empty', 'INVALID_INPUT');
    }

    if (trimmedName.length > 500) {
      logger.warn({ length: trimmedName.length }, "[SeriesService] Series name too long");
      throw new SeriesError('Series name is too long (max 500 characters)', 'INVALID_INPUT');
    }

    try {
      logger.debug({ seriesName: trimmedName }, "[SeriesService] Fetching series info");
      const series = await seriesRepository.getSeriesByName(trimmedName);
      
      if (!series) {
        logger.debug({ seriesName: trimmedName }, "[SeriesService] Series not found");
        return null;
      }

      logger.debug({ seriesName: trimmedName, bookCount: series.bookCount }, "[SeriesService] Retrieved series info");
      return series;
    } catch (error) {
      if (error instanceof SeriesError) {
        throw error;
      }
      logger.error({ err: error, seriesName: trimmedName }, "[SeriesService] Failed to get series info");
      throw new SeriesError(
        'Failed to retrieve series information',
        'DATABASE_ERROR',
        error
      );
    }
  }
}

// Export singleton instance
export const seriesService = new SeriesService();
