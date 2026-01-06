/**
 * Tag API Types
 *
 * Type definitions for tag-related API operations.
 */

import type { Book } from "@/lib/db/schema/books";
import type { TagOperationResult } from "@/types/tag-operations";

/**
 * Tag with statistics
 */
export interface TagWithStats {
  name: string;
  bookCount: number;
}

/**
 * Response from tags stats endpoint
 */
export interface TagStatsResponse {
  tags: TagWithStats[];
  totalBooks: number;
}

/**
 * Request body for renaming a tag
 */
export interface RenameTagRequest {
  newName: string;
}

/**
 * Response from rename/delete/merge operations
 * Re-export TagOperationResult for convenience
 */
export type { TagOperationResult } from "@/types/tag-operations";

/**
 * Request body for merging tags
 */
export interface MergeTagsRequest {
  sourceTags: string[];
  targetTag: string;
}

/**
 * Response from tag books list endpoint
 */
export interface TagBooksResponse {
  books: Book[];
  total: number;
}

/**
 * Request body for bulk tag operations
 */
export interface BulkTagRequest {
  bookIds: number[];
  tags: string[];
  action: "add" | "remove";
}

/**
 * Response from bulk tag operations
 */
export interface BulkTagResponse {
  success: boolean;
  message?: string;
  error?: string;
}
