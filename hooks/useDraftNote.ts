import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for managing draft notes in localStorage on a per-book basis.
 * Automatically saves and restores draft notes for each book.
 */
export function useDraftNote(bookId: number) {
  const storageKey = `draft-note-${bookId}`;
  
  const [draftNote, setDraftNote] = useState<string>("");

  // Load draft from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDraft = localStorage.getItem(storageKey);
      if (savedDraft) {
        setDraftNote(savedDraft);
      }
    }
  }, [storageKey]);

  // Save draft to localStorage whenever it changes
  const saveDraft = useCallback((note: string) => {
    setDraftNote(note);
    if (typeof window !== "undefined") {
      if (note.trim()) {
        localStorage.setItem(storageKey, note);
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    setDraftNote("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return {
    draftNote,
    saveDraft,
    clearDraft,
  };
}
