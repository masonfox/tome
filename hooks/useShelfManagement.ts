import { useState, useCallback } from "react";
import { toast } from "@/utils/toast";
import type { Shelf } from "@/lib/db/schema/shelves";

export interface ShelfWithBookCount extends Shelf {
  bookCount: number;
}

export interface ShelfWithBookCountAndCovers extends ShelfWithBookCount {
  bookCoverIds: number[];
}

export interface CreateShelfData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateShelfData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export function useShelfManagement() {
  const [shelves, setShelves] = useState<ShelfWithBookCountAndCovers[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch all shelves with book counts and cover IDs
   */
  const fetchShelves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/shelves?withCovers=true");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch shelves");
      }

      setShelves(data.data);
      return data.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      toast.error(`Failed to load shelves: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new shelf
   */
  const createShelf = useCallback(
    async (shelfData: CreateShelfData) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/shelves", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(shelfData),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to create shelf");
        }

        // Add the new shelf to the list with 0 books and empty cover array
        const newShelf: ShelfWithBookCountAndCovers = {
          ...data.data,
          bookCount: 0,
          bookCoverIds: [],
        };
        setShelves((prev) => [...prev, newShelf]);

        toast.success(`Shelf "${shelfData.name}" created successfully`);
        return data.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(`Failed to create shelf: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Update an existing shelf
   */
  const updateShelf = useCallback(
    async (shelfId: number, updates: UpdateShelfData) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/shelves/${shelfId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to update shelf");
        }

        // Update the shelf in the list
        setShelves((prev) =>
          prev.map((shelf) =>
            shelf.id === shelfId
              ? { ...shelf, ...data.data }
              : shelf
          )
        );

        toast.success("Shelf updated successfully");
        return data.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(`Failed to update shelf: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Delete a shelf
   */
  const deleteShelf = useCallback(
    async (shelfId: number) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/shelves/${shelfId}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || "Failed to delete shelf");
        }

        // Remove the shelf from the list
        setShelves((prev) => prev.filter((shelf) => shelf.id !== shelfId));

        toast.success("Shelf deleted successfully");
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        toast.error(`Failed to delete shelf: ${error.message}`);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    shelves,
    loading,
    error,
    fetchShelves,
    createShelf,
    updateShelf,
    deleteShelf,
  };
}
