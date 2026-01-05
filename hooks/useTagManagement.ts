import { useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TagOperationResult } from "@/types/tag-operations";

export interface TagWithStats {
  name: string;
  bookCount: number;
}

export function useTagManagement() {
  const queryClient = useQueryClient();
  const beforeRefetchCallback = useRef<(() => void) | null>(null);
  const afterRefetchCallback = useRef<(() => void) | null>(null);

  // Tags query with TanStack Query
  const { 
    data, 
    isLoading: loading, 
    error: queryError,
    refetch: refetchQuery 
  } = useQuery({
    queryKey: ['tags-stats'],
    queryFn: async () => {
      const response = await fetch("/api/tags/stats");
      
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }

      const data = await response.json();
      return {
        tags: (data.tags || []) as TagWithStats[],
        totalBooks: data.totalBooks || 0,
      };
    },
    staleTime: 30000, // 30 seconds - data stays fresh for 30s
    gcTime: 300000, // 5 minutes - cache stays in memory for 5 min
  });

  const tags = data?.tags || [];
  const totalBooks = data?.totalBooks || 0;
  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch tags") : null;

  // Wrapper for refetch that calls before/after callbacks
  const fetchTags = useCallback(async () => {
    beforeRefetchCallback.current?.();
    const result = await refetchQuery();
    afterRefetchCallback.current?.();
    return result;
  }, [refetchQuery]);

  // Rename tag mutation
  const renameTagMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const response = await fetch(`/api/tags/${encodeURIComponent(oldName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to rename tag");
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate tags query to refetch
      queryClient.invalidateQueries({ queryKey: ['tags-stats'] });
      // Invalidate available tags cache for book detail pages
      queryClient.invalidateQueries({ queryKey: ['availableTags'] });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const response = await fetch(`/api/tags/${encodeURIComponent(tagName)}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete tag");
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate tags query to refetch
      queryClient.invalidateQueries({ queryKey: ['tags-stats'] });
      // Invalidate available tags cache for book detail pages
      queryClient.invalidateQueries({ queryKey: ['availableTags'] });
    },
  });

  // Merge tags mutation
  const mergeTagsMutation = useMutation({
    mutationFn: async ({ sourceTags, targetTag }: { sourceTags: string[]; targetTag: string }) => {
      const response = await fetch("/api/tags/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTags, targetTag }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to merge tags");
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate tags query to refetch
      queryClient.invalidateQueries({ queryKey: ['tags-stats'] });
      // Invalidate available tags cache for book detail pages
      queryClient.invalidateQueries({ queryKey: ['availableTags'] });
    },
  });

  // Wrapper functions that match the old API
  const renameTag = useCallback(async (oldName: string, newName: string): Promise<TagOperationResult> => {
    const result = await renameTagMutation.mutateAsync({ oldName, newName });
    return {
      success: result.success,
      partialSuccess: result.partialSuccess,
      totalBooks: result.totalBooks,
      successCount: result.successCount,
      failureCount: result.failureCount,
      calibreFailures: result.calibreFailures || [],
      tomeFailures: result.tomeFailures || [],
    };
  }, [renameTagMutation]);

  const deleteTag = useCallback(async (tagName: string): Promise<TagOperationResult> => {
    const result = await deleteTagMutation.mutateAsync(tagName);
    return {
      success: result.success,
      partialSuccess: result.partialSuccess,
      totalBooks: result.totalBooks,
      successCount: result.successCount,
      failureCount: result.failureCount,
      calibreFailures: result.calibreFailures || [],
      tomeFailures: result.tomeFailures || [],
    };
  }, [deleteTagMutation]);

  const mergeTags = useCallback(async (sourceTags: string[], targetTag: string): Promise<TagOperationResult> => {
    const result = await mergeTagsMutation.mutateAsync({ sourceTags, targetTag });
    return {
      success: result.success,
      partialSuccess: result.partialSuccess,
      totalBooks: result.totalBooks,
      successCount: result.successCount,
      failureCount: result.failureCount,
      calibreFailures: result.calibreFailures || [],
      tomeFailures: result.tomeFailures || [],
    };
  }, [mergeTagsMutation]);

  return {
    tags,
    totalBooks,
    loading,
    error,
    refetch: fetchTags,
    renameTag,
    deleteTag,
    mergeTags,
    setBeforeRefetch: (callback: (() => void) | null) => {
      beforeRefetchCallback.current = callback;
    },
    setAfterRefetch: (callback: (() => void) | null) => {
      afterRefetchCallback.current = callback;
    },
  };
}
