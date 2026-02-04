/**
 * Tag API
 *
 * Domain API for managing tags and tag-related operations.
 */

import { baseApiClient, type RequestOptions } from "../../base-client";
import type {
  TagStatsResponse,
  RenameTagRequest,
  TagOperationResult,
  MergeTagsRequest,
  TagBooksResponse,
  BulkTagRequest,
  BulkTagResponse,
} from "./types";

/**
 * Tag API operations
 */
export const tagApi = {
  /**
   * Get all tags with statistics
   * 
   * @returns Tags with book counts and total books
   * @throws {ApiError} When request fails
   * 
   * @example
   * const response = await tagApi.getStats();
   * console.log(`Found ${response.tags.length} tags`);
   */
  getStats: (): Promise<TagStatsResponse> => {
    return baseApiClient["get"]<TagStatsResponse>("/api/tags/stats");
  },

  /**
   * Rename a tag
   * 
   * @param tagName - The current tag name to rename
   * @param newName - The new name for the tag
   * @returns Operation result with success/failure counts
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await tagApi.rename("SciFi", "Science Fiction");
   * if (result.success) {
   *   console.log(`Renamed tag on ${result.successCount} books`);
   * }
   */
  rename: (
    tagName: string,
    newName: string
  ): Promise<TagOperationResult> => {
    return baseApiClient["patch"]<RenameTagRequest, TagOperationResult>(
      `/api/tags/${encodeURIComponent(tagName)}`,
      { newName }
    );
  },

  /**
   * Delete a tag from all books
   * 
   * @param tagName - The tag name to delete
   * @returns Operation result with success/failure counts
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await tagApi.delete("old-tag");
   * if (result.success) {
   *   console.log(`Deleted tag from ${result.successCount} books`);
   * }
   */
  delete: (tagName: string): Promise<TagOperationResult> => {
    return baseApiClient["delete"]<undefined, TagOperationResult>(
      `/api/tags/${encodeURIComponent(tagName)}`
    );
  },

  /**
   * Merge multiple tags into a target tag
   * 
   * @param sourceTags - Array of tag names to merge from
   * @param targetTag - The tag name to merge into
   * @returns Operation result with success/failure counts
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await tagApi.merge(["tag1", "tag2"], "merged-tag");
   * if (result.success) {
   *   console.log(`Merged tags on ${result.successCount} books`);
   * }
   */
  merge: (
    sourceTags: string[],
    targetTag: string
  ): Promise<TagOperationResult> => {
    return baseApiClient["post"]<MergeTagsRequest, TagOperationResult>(
      "/api/tags/merge",
      { sourceTags, targetTag }
    );
  },

  /**
   * List books that have a specific tag
   * 
   * @param tagName - The tag name to filter by
   * @param paginationOptions - Pagination options (limit, skip)
   * @param requestOptions - Request options (e.g., AbortSignal for cancellation)
   * @returns Books with the tag and total count
   * @throws {ApiError} When request fails
   * 
   * @example
   * const response = await tagApi.listBooks("fantasy", { limit: 50, skip: 0 });
   * console.log(`Found ${response.total} fantasy books`);
   * 
   * @example
   * // With abort signal for cancellation
   * const controller = new AbortController();
   * const response = await tagApi.listBooks("fantasy", { limit: 50 }, { signal: controller.signal });
   */
  listBooks: (
    tagName: string,
    paginationOptions?: { limit?: number; skip?: number },
    requestOptions?: RequestOptions
  ): Promise<TagBooksResponse> => {
    const params = new URLSearchParams();
    if (paginationOptions?.limit) params.append("limit", paginationOptions.limit.toString());
    if (paginationOptions?.skip) params.append("skip", paginationOptions.skip.toString());
    
    const queryString = params.toString();
    const endpoint = `/api/tags/${encodeURIComponent(tagName)}${queryString ? `?${queryString}` : ""}`;
    
    return baseApiClient["get"]<TagBooksResponse>(endpoint, requestOptions);
  },

  /**
   * Bulk add or remove tags from books
   * 
   * @param bookIds - Array of book IDs to modify
   * @param tags - Array of tag names to add or remove
   * @param action - Whether to "add" or "remove" the tags
   * @returns Operation response
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await tagApi.bulkOperation([1, 2, 3], ["new-tag"], "add");
   * if (result.success) {
   *   console.log("Tags added successfully");
   * }
   */
  bulkOperation: (
    bookIds: number[],
    tags: string[],
    action: "add" | "remove"
  ): Promise<BulkTagResponse> => {
    return baseApiClient["post"]<BulkTagRequest, BulkTagResponse>(
      "/api/tags/bulk",
      { bookIds, tags, action }
    );
  },
} as const;
