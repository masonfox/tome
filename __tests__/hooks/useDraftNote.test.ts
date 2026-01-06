import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from "@testing-library/react";
import { useDraftNote } from "@/hooks/useDraftNote";

describe("useDraftNote", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("should initialize with empty draft", () => {
    const { result } = renderHook(() => useDraftNote(123));

    expect(result.current.draftNote).toBe("");
  });

  test("should load existing draft from localStorage on mount", () => {
    const bookId = 123;
    const storageKey = `draft-note-${bookId}`;
    const savedDraft = "This is my saved draft";

    localStorage.setItem(storageKey, savedDraft);

    const { result } = renderHook(() => useDraftNote(bookId));

    expect(result.current.draftNote).toBe(savedDraft);
  });

  test("should save draft to localStorage when saveDraft is called", () => {
    const bookId = 123;
    const storageKey = `draft-note-${bookId}`;
    const draftText = "New draft note";

    const { result } = renderHook(() => useDraftNote(bookId));

    act(() => {
      result.current.saveDraft(draftText);
    });

    expect(result.current.draftNote).toBe(draftText);
    expect(localStorage.getItem(storageKey)).toBe(draftText);
  });

  test("should remove draft from localStorage when draft is empty", () => {
    const bookId = 123;
    const storageKey = `draft-note-${bookId}`;

    // First set a draft
    localStorage.setItem(storageKey, "Some draft");

    const { result } = renderHook(() => useDraftNote(bookId));

    // Save an empty draft
    act(() => {
      result.current.saveDraft("");
    });

    expect(result.current.draftNote).toBe("");
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test("should remove draft from localStorage when draft contains only whitespace", () => {
    const bookId = 123;
    const storageKey = `draft-note-${bookId}`;

    // First set a draft
    localStorage.setItem(storageKey, "Some draft");

    const { result } = renderHook(() => useDraftNote(bookId));

    // Save a whitespace-only draft
    act(() => {
      result.current.saveDraft("   ");
    });

    expect(result.current.draftNote).toBe("   ");
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test("should clear draft when clearDraft is called", () => {
    const bookId = 123;
    const storageKey = `draft-note-${bookId}`;
    const draftText = "Draft to be cleared";

    const { result } = renderHook(() => useDraftNote(bookId));

    // First save a draft
    act(() => {
      result.current.saveDraft(draftText);
    });

    expect(result.current.draftNote).toBe(draftText);
    expect(localStorage.getItem(storageKey)).toBe(draftText);

    // Now clear it
    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.draftNote).toBe("");
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test("should use per-book storage keys", () => {
    const bookId1 = 123;
    const bookId2 = 456;
    const draft1 = "Draft for book 123";
    const draft2 = "Draft for book 456";

    // Set up hook for first book
    const { result: result1 } = renderHook(() => useDraftNote(bookId1));

    act(() => {
      result1.current.saveDraft(draft1);
    });

    // Set up hook for second book
    const { result: result2 } = renderHook(() => useDraftNote(bookId2));

    act(() => {
      result2.current.saveDraft(draft2);
    });

    // Verify both drafts are stored independently
    expect(result1.current.draftNote).toBe(draft1);
    expect(result2.current.draftNote).toBe(draft2);
    expect(localStorage.getItem(`draft-note-${bookId1}`)).toBe(draft1);
    expect(localStorage.getItem(`draft-note-${bookId2}`)).toBe(draft2);
  });

  test("should handle changing bookId", () => {
    const bookId1 = 123;
    const bookId2 = 456;
    const draft1 = "Draft for book 123";
    const draft2 = "Draft for book 456";

    // Save drafts for both books
    localStorage.setItem(`draft-note-${bookId1}`, draft1);
    localStorage.setItem(`draft-note-${bookId2}`, draft2);

    // Start with first book
    const { result, rerender } = renderHook(
      ({ id }) => useDraftNote(id),
      { initialProps: { id: bookId1 } }
    );

    expect(result.current.draftNote).toBe(draft1);

    // Switch to second book
    rerender({ id: bookId2 });

    expect(result.current.draftNote).toBe(draft2);
  });

  test("should update draft when saveDraft is called multiple times", () => {
    const bookId = 123;
    const storageKey = `draft-note-${bookId}`;

    const { result } = renderHook(() => useDraftNote(bookId));

    act(() => {
      result.current.saveDraft("First draft");
    });

    expect(result.current.draftNote).toBe("First draft");
    expect(localStorage.getItem(storageKey)).toBe("First draft");

    act(() => {
      result.current.saveDraft("Second draft");
    });

    expect(result.current.draftNote).toBe("Second draft");
    expect(localStorage.getItem(storageKey)).toBe("Second draft");

    act(() => {
      result.current.saveDraft("Final draft");
    });

    expect(result.current.draftNote).toBe("Final draft");
    expect(localStorage.getItem(storageKey)).toBe("Final draft");
  });
});
