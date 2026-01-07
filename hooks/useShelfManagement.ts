import { useState, useCallback } from "react";
import { toast } from "@/utils/toast";
import { shelfApi, ApiError } from "@/lib/api";
import type {
  ShelfWithBookCountAndCovers,
  CreateShelfRequest,
  UpdateShelfRequest,
} from "@/lib/api";

export function useShelfManagement() {
  const [shelves, setShelves] = useState<ShelfWithBookCountAndCovers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch all shelves with book counts and cover IDs
   */
  const fetchShelves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shelfApi.list({ withCovers: true });
      setShelves(data as ShelfWithBookCountAndCovers[]);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      
      // Extract user-friendly message from ApiError
      const message = err instanceof ApiError 
        ? err.message 
        : error.message;
      
      toast.error(`Failed to load shelves: ${message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new shelf
   */
  const createShelf = useCallback(
    async (shelfData: CreateShelfRequest) => {
      setLoading(true);
      setError(null);
      try {
        const shelf = await shelfApi.create(shelfData);

        // Add the new shelf to the list with 0 books and empty cover array
        const newShelf: ShelfWithBookCountAndCovers = {
          ...shelf,
          bookCount: 0,
          bookCoverIds: [],
        };
        setShelves((prev) => [...prev, newShelf]);

        toast.success(`Shelf "${shelfData.name}" created successfully`);
        return shelf;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError 
          ? err.message 
          : error.message;
        
        toast.error(`Failed to create shelf: ${message}`);
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
    async (shelfId: number, updates: UpdateShelfRequest) => {
      setLoading(true);
      setError(null);
      try {
        const shelf = await shelfApi.update(shelfId, updates);

        // Update the shelf in the list
        setShelves((prev) =>
          prev.map((s) =>
            s.id === shelfId
              ? { ...s, ...shelf }
              : s
          )
        );

        toast.success("Shelf updated successfully");
        return shelf;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError 
          ? err.message 
          : error.message;
        
        toast.error(`Failed to update shelf: ${message}`);
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
        await shelfApi.delete(shelfId);

        // Remove the shelf from the list
        setShelves((prev) => prev.filter((shelf) => shelf.id !== shelfId));

        toast.success("Shelf deleted successfully");
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        
        // Extract user-friendly message from ApiError
        const message = err instanceof ApiError 
          ? err.message 
          : error.message;
        
        toast.error(`Failed to delete shelf: ${message}`);
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
