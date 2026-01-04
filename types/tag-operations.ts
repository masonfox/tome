/**
 * Shared types for tag operation results
 * Used by API responses, hooks, and UI components
 */

export interface TagOperationFailure {
  calibreId: number;
  bookId?: number;
  title?: string;
  error: string;
}

export interface TomeFailure {
  bookId: number;
  error: string;
}

export interface TagOperationResult {
  success: boolean;
  partialSuccess: boolean;
  totalBooks: number;
  successCount: number;
  failureCount: number;
  calibreFailures?: TagOperationFailure[];
  tomeFailures?: TomeFailure[];
}

export interface MergeTagsResult extends TagOperationResult {
  mergedTags: string[];
  targetTag: string;
}

export interface RenameTagResult extends TagOperationResult {
  oldName: string;
  newName: string;
}

export interface DeleteTagResult extends TagOperationResult {
  deletedTag: string;
}

export interface BulkDeleteTagsResult extends TagOperationResult {
  deletedTags: string[];
  tagsDeleted: number;
}
