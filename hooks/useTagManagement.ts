import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TagOperationResult } from "@/types/tag-operations";

export interface TagWithStats {
  name: string;
  bookCount: number;
}

export function useTagManagement() {
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<TagWithStats[]>([]);
  const [totalBooks, setTotalBooks] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/tags/stats");
      
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }

      const data = await response.json();
      setTags(data.tags || []);
      setTotalBooks(data.totalBooks || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags, queryClient]);

  const renameTag = useCallback(async (oldName: string, newName: string): Promise<TagOperationResult> => {
    const response = await fetch(`/api/tags/${encodeURIComponent(oldName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to rename tag");
    }

    // Refresh tags after operation (even partial success)
    await fetchTags();
    
    // Invalidate available tags cache for book detail pages
    queryClient.invalidateQueries({ queryKey: ['availableTags'] });
    
    return {
      success: data.success,
      partialSuccess: data.partialSuccess,
      totalBooks: data.totalBooks,
      successCount: data.successCount,
      failureCount: data.failureCount,
      calibreFailures: data.calibreFailures || [],
      tomeFailures: data.tomeFailures || [],
    };
  }, [fetchTags, queryClient]);

  const deleteTag = useCallback(async (tagName: string): Promise<TagOperationResult> => {
    const response = await fetch(`/api/tags/${encodeURIComponent(tagName)}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to delete tag");
    }

    // Refresh tags after operation (even partial success)
    await fetchTags();
    
    // Invalidate available tags cache for book detail pages
    queryClient.invalidateQueries({ queryKey: ['availableTags'] });
    
    return {
      success: data.success,
      partialSuccess: data.partialSuccess,
      totalBooks: data.totalBooks,
      successCount: data.successCount,
      failureCount: data.failureCount,
      calibreFailures: data.calibreFailures || [],
      tomeFailures: data.tomeFailures || [],
    };
  }, [fetchTags, queryClient]);

  const mergeTags = useCallback(async (sourceTags: string[], targetTag: string): Promise<TagOperationResult> => {
    const response = await fetch("/api/tags/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTags, targetTag }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to merge tags");
    }

    // Refresh tags after operation (even partial success)
    await fetchTags();
    
    // Invalidate available tags cache for book detail pages
    queryClient.invalidateQueries({ queryKey: ['availableTags'] });
    
    return {
      success: data.success,
      partialSuccess: data.partialSuccess,
      totalBooks: data.totalBooks,
      successCount: data.successCount,
      failureCount: data.failureCount,
      calibreFailures: data.calibreFailures || [],
      tomeFailures: data.tomeFailures || [],
    };
  }, [fetchTags, queryClient]);

  return {
    tags,
    totalBooks,
    loading,
    error,
    refetch: fetchTags,
    renameTag,
    deleteTag,
    mergeTags,
  };
}
