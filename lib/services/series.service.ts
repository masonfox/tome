import { seriesRepository, SeriesInfo, SeriesBook } from "@/lib/repositories/series.repository";

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
      throw error;
    }
  }

  /**
   * Get all books in a specific series
   * @param seriesName - Name of the series
   * @returns Array of books in the series, ordered by series index
   */
  async getBooksBySeries(seriesName: string): Promise<SeriesBook[]> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    try {
      logger.debug({ seriesName }, "[SeriesService] Fetching books for series");
      const books = await seriesRepository.getBooksBySeries(seriesName);
      logger.debug({ seriesName, count: books.length }, "[SeriesService] Retrieved books for series");
      return books;
    } catch (error) {
      logger.error({ err: error, seriesName }, "[SeriesService] Failed to get books for series");
      throw error;
    }
  }

  /**
   * Get series information by name
   * @param seriesName - Name of the series
   * @returns Series info or null if not found
   */
  async getSeriesByName(seriesName: string): Promise<SeriesInfo | null> {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();

    try {
      logger.debug({ seriesName }, "[SeriesService] Fetching series info");
      const series = await seriesRepository.getSeriesByName(seriesName);
      
      if (!series) {
        logger.debug({ seriesName }, "[SeriesService] Series not found");
        return null;
      }

      logger.debug({ seriesName, bookCount: series.bookCount }, "[SeriesService] Retrieved series info");
      return series;
    } catch (error) {
      logger.error({ err: error, seriesName }, "[SeriesService] Failed to get series info");
      throw error;
    }
  }
}

// Export singleton instance
export const seriesService = new SeriesService();
