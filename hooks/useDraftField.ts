import { useState, useEffect, useCallback } from "react";

/**
 * Generic hook for managing draft text fields in localStorage.
 * Provides automatic save and restore functionality with initialization guard.
 * 
 * @param storageKey - Unique key for localStorage (e.g., 'draft-finish-review-123')
 * @returns Object with draft state and control functions
 * 
 * @example
 * // In a modal component
 * const { draft, saveDraft, clearDraft, isInitialized } = useDraftField('draft-review-book-123');
 * 
 * // Restore draft on mount
 * useEffect(() => {
 *   if (draft && !value) {
 *     setValue(draft);
 *   }
 * }, [draft]);
 * 
 * // Auto-save as user types (only after initialization)
 * useEffect(() => {
 *   if (isInitialized) {
 *     saveDraft(value);
 *   }
 * }, [value, isInitialized, saveDraft]);
 * 
 * // Clear on successful submission
 * const handleSubmit = async () => {
 *   await submitData();
 *   clearDraft();
 * };
 */
export function useDraftField(storageKey: string) {
  const [draft, setDraft] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        setDraft(savedDraft);
      }
    }
    setIsInitialized(true);
  }, [storageKey]);

  // Save draft to localStorage
  const saveDraft = useCallback((value: string) => {
    setDraft(value);
    if (typeof window !== "undefined") {
      if (value.trim()) {
        localStorage.setItem(storageKey, value);
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    setDraft("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return {
    draft,
    saveDraft,
    clearDraft,
    isInitialized,
  };
}
