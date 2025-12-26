import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { useDraftField } from "@/hooks/useDraftField";

describe("useDraftField", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("should initialize with empty draft and set isInitialized to true", () => {
    const { result } = renderHook(() => useDraftField("test-key"));

    expect(result.current.draft).toBe("");
    expect(result.current.isInitialized).toBe(true);
  });

  test("should load existing draft from localStorage on mount", () => {
    const storageKey = "test-key";
    const savedDraft = "This is my saved draft";

    localStorage.setItem(storageKey, savedDraft);

    const { result } = renderHook(() => useDraftField(storageKey));

    expect(result.current.draft).toBe(savedDraft);
    expect(result.current.isInitialized).toBe(true);
  });

  test("should save draft to localStorage when saveDraft is called", () => {
    const storageKey = "test-key";
    const draftText = "New draft text";

    const { result } = renderHook(() => useDraftField(storageKey));

    act(() => {
      result.current.saveDraft(draftText);
    });

    expect(result.current.draft).toBe(draftText);
    expect(localStorage.getItem(storageKey)).toBe(draftText);
  });

  test("should remove draft from localStorage when draft is empty", () => {
    const storageKey = "test-key";

    // First set a draft
    localStorage.setItem(storageKey, "Some draft");

    const { result } = renderHook(() => useDraftField(storageKey));

    // Save an empty draft
    act(() => {
      result.current.saveDraft("");
    });

    expect(result.current.draft).toBe("");
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test("should remove draft from localStorage when draft contains only whitespace", () => {
    const storageKey = "test-key";

    // First set a draft
    localStorage.setItem(storageKey, "Some draft");

    const { result } = renderHook(() => useDraftField(storageKey));

    // Save a whitespace-only draft
    act(() => {
      result.current.saveDraft("   ");
    });

    expect(result.current.draft).toBe("   ");
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test("should clear draft when clearDraft is called", () => {
    const storageKey = "test-key";
    const draftText = "Draft to be cleared";

    const { result } = renderHook(() => useDraftField(storageKey));

    // First save a draft
    act(() => {
      result.current.saveDraft(draftText);
    });

    expect(result.current.draft).toBe(draftText);
    expect(localStorage.getItem(storageKey)).toBe(draftText);

    // Now clear it
    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.draft).toBe("");
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  test("should use different storage keys independently", () => {
    const key1 = "test-key-1";
    const key2 = "test-key-2";
    const draft1 = "Draft for key 1";
    const draft2 = "Draft for key 2";

    // Set up hook for first key
    const { result: result1 } = renderHook(() => useDraftField(key1));

    act(() => {
      result1.current.saveDraft(draft1);
    });

    // Set up hook for second key
    const { result: result2 } = renderHook(() => useDraftField(key2));

    act(() => {
      result2.current.saveDraft(draft2);
    });

    // Verify both drafts are stored independently
    expect(result1.current.draft).toBe(draft1);
    expect(result2.current.draft).toBe(draft2);
    expect(localStorage.getItem(key1)).toBe(draft1);
    expect(localStorage.getItem(key2)).toBe(draft2);
  });

  test("should handle changing storage keys", () => {
    const key1 = "test-key-1";
    const key2 = "test-key-2";
    const draft1 = "Draft for key 1";
    const draft2 = "Draft for key 2";

    // Save drafts for both keys
    localStorage.setItem(key1, draft1);
    localStorage.setItem(key2, draft2);

    // Start with first key
    const { result, rerender } = renderHook(
      ({ key }) => useDraftField(key),
      { initialProps: { key: key1 } }
    );

    expect(result.current.draft).toBe(draft1);

    // Switch to second key
    rerender({ key: key2 });

    expect(result.current.draft).toBe(draft2);
  });

  test("should update draft when saveDraft is called multiple times", () => {
    const storageKey = "test-key";

    const { result } = renderHook(() => useDraftField(storageKey));

    act(() => {
      result.current.saveDraft("First draft");
    });

    expect(result.current.draft).toBe("First draft");
    expect(localStorage.getItem(storageKey)).toBe("First draft");

    act(() => {
      result.current.saveDraft("Second draft");
    });

    expect(result.current.draft).toBe("Second draft");
    expect(localStorage.getItem(storageKey)).toBe("Second draft");

    act(() => {
      result.current.saveDraft("Final draft");
    });

    expect(result.current.draft).toBe("Final draft");
    expect(localStorage.getItem(storageKey)).toBe("Final draft");
  });

  test("should maintain isInitialized as true after operations", () => {
    const storageKey = "test-key";
    const { result } = renderHook(() => useDraftField(storageKey));

    expect(result.current.isInitialized).toBe(true);

    act(() => {
      result.current.saveDraft("Some text");
    });

    expect(result.current.isInitialized).toBe(true);

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.isInitialized).toBe(true);
  });
});
