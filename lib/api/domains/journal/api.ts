/**
 * Journal API Client
 * 
 * Typed API client for journal-related operations.
 */

import { baseApiClient } from "../../base-client";
import type {
  ListJournalEntriesRequest,
  ListJournalEntriesResponse,
  GetArchiveRequest,
  GetArchiveResponse,
} from "./types";

/**
 * Journal API
 * 
 * Provides methods for interacting with journal entries and archive metadata.
 * 
 * @example
 * import { journalApi } from '@/lib/api';
 * 
 * // List journal entries
 * const result = await journalApi.listEntries({
 *   timezone: 'America/New_York',
 *   limit: 50,
 *   skip: 0
 * });
 * 
 * // Get archive metadata
 * const archive = await journalApi.getArchive({ timezone: 'America/New_York' });
 */
export const journalApi = {
  /**
   * List journal entries with pagination
   * 
   * @param params - Request parameters
   * @returns Paginated list of grouped journal entries
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await journalApi.listEntries({
   *   timezone: 'America/New_York',
   *   limit: 50,
   *   skip: 0
   * });
   */
  listEntries: (params: ListJournalEntriesRequest = {}): Promise<ListJournalEntriesResponse> => {
    const { timezone = 'America/New_York', limit = 50, skip = 0 } = params;
    const queryParams = new URLSearchParams({
      timezone,
      limit: limit.toString(),
      skip: skip.toString(),
    });
    
    return baseApiClient["get"]<ListJournalEntriesResponse>(
      `/api/journal?${queryParams.toString()}`
    );
  },

  /**
   * Get archive metadata (hierarchical date tree)
   * 
   * @param params - Request parameters
   * @returns Archive tree with years, months, and weeks
   * @throws {ApiError} When request fails
   * 
   * @example
   * const archive = await journalApi.getArchive({
   *   timezone: 'America/New_York'
   * });
   */
  getArchive: (params: GetArchiveRequest = {}): Promise<GetArchiveResponse> => {
    const { timezone = 'America/New_York' } = params;
    const queryParams = new URLSearchParams({ timezone });
    
    return baseApiClient["get"]<GetArchiveResponse>(
      `/api/journal/archive?${queryParams.toString()}`
    );
  },
};
