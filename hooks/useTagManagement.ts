import { useState, useEffect, useCallback } from "react";

export interface TagWithStats {
  name: string;
  bookCount: number;
}

export function useTagManagement() {
  const [tags, setTags] = useState<TagWithStats[]>([]);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const renameTag = useCallback(async (oldName: string, newName: string) => {
    try {
      const response = await fetch(`/api/tags/${encodeURIComponent(oldName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to rename tag");
      }

      // Refresh tags after successful rename
      await fetchTags();
      
      const data = await response.json();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to rename tag");
    }
  }, [fetchTags]);

  const deleteTag = useCallback(async (tagName: string) => {
    try {
      const response = await fetch(`/api/tags/${encodeURIComponent(tagName)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete tag");
      }

      // Refresh tags after successful delete
      await fetchTags();
      
      const data = await response.json();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to delete tag");
    }
  }, [fetchTags]);

  const mergeTags = useCallback(async (sourceTags: string[], targetTag: string) => {
    try {
      const response = await fetch("/api/tags/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTags, targetTag }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to merge tags");
      }

      // Refresh tags after successful merge
      await fetchTags();
      
      const data = await response.json();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to merge tags");
    }
  }, [fetchTags]);

  return {
    tags,
    loading,
    error,
    refetch: fetchTags,
    renameTag,
    deleteTag,
    mergeTags,
  };
}
