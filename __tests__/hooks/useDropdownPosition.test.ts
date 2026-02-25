import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from "@testing-library/react";
import { useDropdownPosition } from "@/hooks/useDropdownPosition";
import { RefObject } from "react";

describe("useDropdownPosition", () => {
  let mockButtonRef: RefObject<HTMLButtonElement>;
  let mockMenuRef: RefObject<HTMLDivElement>;
  let mockButtonElement: HTMLButtonElement;
  let mockMenuElement: HTMLDivElement;

  beforeEach(() => {
    // Create mock elements
    mockButtonElement = document.createElement("button");
    mockMenuElement = document.createElement("div");

    // Create refs
    mockButtonRef = { current: mockButtonElement };
    mockMenuRef = { current: mockMenuElement };

    // Mock window.innerHeight
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 1000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial state", () => {
    test("should return initial position {top: 0, left: 0} when closed", () => {
      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, false)
      );

      expect(result.current).toEqual({ top: 0, left: 0 });
    });

    test("should calculate position when isOpen is true", () => {
      // Mock getBoundingClientRect for button at middle of screen
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 400,
        bottom: 440,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 400,
        toJSON: () => ({}),
      });

      // Mock menu height
      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 150,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true)
      );

      // Should position below button (bottom + gap)
      expect(result.current.top).toBe(444); // 440 + 4
      expect(result.current.left).toBe(8); // 200 - 192
    });
  });

  describe("Positioning below when space available", () => {
    test("should position below button when sufficient space below", () => {
      // Button near top of viewport
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 140,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 150,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true)
      );

      // Should position below: bottom (140) + gap (4) = 144
      expect(result.current.top).toBe(144);
      expect(result.current.left).toBe(8); // right (200) - menuWidth (192)
    });

    test("should use custom gap option", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 140,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 100,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true, { gap: 8 })
      );

      // Should position with custom gap: bottom (140) + gap (8) = 148
      expect(result.current.top).toBe(148);
    });
  });

  describe("Positioning above when insufficient space below", () => {
    test("should position above button when not enough space below but enough above", () => {
      // Button near bottom of viewport
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 800,
        bottom: 840,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 800,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 200,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true)
      );

      // Space below: 1000 - 840 = 160 (not enough for 200 + 4)
      // Space above: 800 (enough for 200 + 4)
      // Should position above: top (800) - menuHeight (200) - gap (4) = 596
      expect(result.current.top).toBe(596);
      expect(result.current.left).toBe(8);
    });

    test("should respect viewport top boundary when positioning above", () => {
      // Button near bottom, but viewport is small and menu is very tall
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 450,
        bottom: 490,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 450,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 900,
      });

      // Set viewport height smaller
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true)
      );

      // Space below: 500 - 490 = 10 (not enough for 900 + 4)
      // Space above: 450 (not enough for 900 + 4)
      // More space above (450) than below (10), so choose above
      // top = Math.max(gap, rect.top - menuHeight - gap)
      // Math.max(4, 450 - 900 - 4) = Math.max(4, -454) = 4
      expect(result.current.top).toBe(4); // Prevents going above viewport
    });
  });

  describe("Edge case: menu doesn't fit either way", () => {
    test("should position above when more space above than below", () => {
      // Button in lower-middle of viewport — more space above
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 700,
        bottom: 740,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 700,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true)
      );

      // Space below: 1000 - 740 = 260 (not enough for 400 + 4)
      // Space above: 700 (not enough for 400 + 4)
      // More space above (700) than below (260), so should position above
      // top = Math.max(gap, rect.top - menuHeight - gap)
      // Math.max(4, 700 - 400 - 4) = Math.max(4, 296) = 296
      expect(result.current.top).toBe(296);
    });

    test("should position below when more space below than above", () => {
      // Button in upper-middle of viewport — more space below
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 250,
        bottom: 290,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 250,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true)
      );

      // Space below: 1000 - 290 = 710 (not enough for 400 + 4)
      // Space above: 250 (not enough for 400 + 4)
      // More space below (710) than above (250), so should position below
      expect(result.current.top).toBe(294); // 290 + 4
    });
  });

  describe("Recalculation when menu height changes", () => {
    test("should handle zero menu height on initial render", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 400,
        bottom: 440,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 400,
        toJSON: () => ({}),
      });

      // Initially no height
      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 0,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true)
      );

      // Should position below temporarily when height is 0
      expect(result.current.top).toBe(444); // 440 + 4
      expect(result.current.left).toBe(8);
    });

    test("should recalculate when menu gains height", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 800,
        bottom: 840,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 800,
        toJSON: () => ({}),
      });

      // Start with zero height
      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 0,
      });

      const { result, rerender } = renderHook(
        ({ isOpen }) => useDropdownPosition(mockButtonRef, mockMenuRef, isOpen),
        { initialProps: { isOpen: true } }
      );

      // Initially positioned below due to zero height
      expect(result.current.top).toBe(844); // 840 + 4

      // Menu now has height - simulate DOM update
      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 200,
      });

      // Close and reopen to trigger recalculation (simulates real DOM behavior)
      rerender({ isOpen: false });
      rerender({ isOpen: true });

      // Should reposition above since there's not enough space below
      // Space below: 1000 - 840 = 160 (not enough for 200 + 4)
      // Should position above: 800 - 200 - 4 = 596
      expect(result.current.top).toBe(596);
    });
  });

  describe("Updates when isOpen changes", () => {
    test("should not calculate position when isOpen is false", () => {
      const getBoundingClientRectSpy = vi.spyOn(
        mockButtonElement,
        "getBoundingClientRect"
      );

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, false)
      );

      expect(result.current).toEqual({ top: 0, left: 0 });
      expect(getBoundingClientRectSpy).not.toHaveBeenCalled();
    });

    test("should calculate position when isOpen changes from false to true", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 400,
        bottom: 440,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 400,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 150,
      });

      const { result, rerender } = renderHook(
        ({ isOpen }) => useDropdownPosition(mockButtonRef, mockMenuRef, isOpen),
        { initialProps: { isOpen: false } }
      );

      expect(result.current).toEqual({ top: 0, left: 0 });

      // Open the menu
      rerender({ isOpen: true });

      // Should now have calculated position
      expect(result.current.top).toBe(444);
      expect(result.current.left).toBe(8);
    });

    test("should retain last position when isOpen changes from true to false", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 400,
        bottom: 440,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 400,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 150,
      });

      const { result, rerender } = renderHook(
        ({ isOpen }) => useDropdownPosition(mockButtonRef, mockMenuRef, isOpen),
        { initialProps: { isOpen: true } }
      );

      const openPosition = { ...result.current };
      expect(openPosition.top).toBe(444);

      // Close the menu
      rerender({ isOpen: false });

      // Position should remain the same (not recalculated)
      expect(result.current).toEqual(openPosition);
    });
  });

  describe("Custom options", () => {
    test("should use custom menuWidth option", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 140,
        left: 100,
        right: 300,
        width: 200,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 100,
      });

      const customMenuWidth = 250;
      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true, {
          menuWidth: customMenuWidth,
        })
      );

      // left should be: right (300) - menuWidth (250) = 50
      expect(result.current.left).toBe(50);
    });

    test("should use both custom menuWidth and gap options", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 140,
        left: 100,
        right: 300,
        width: 200,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 100,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true, {
          menuWidth: 250,
          gap: 10,
        })
      );

      // top should be: bottom (140) + gap (10) = 150
      expect(result.current.top).toBe(150);
      // left should be: right (300) - menuWidth (250) = 50
      expect(result.current.left).toBe(50);
    });
  });

  describe("DOM-derived menu width", () => {
    test("should use offsetWidth from menuRef instead of default menuWidth", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 140,
        left: 100,
        right: 300,
        width: 200,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 100,
      });

      // Set a DOM-measured width different from the default (192)
      Object.defineProperty(mockMenuElement, "offsetWidth", {
        writable: true,
        configurable: true,
        value: 220,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true)
      );

      // left should be: right (300) - offsetWidth (220) = 80
      expect(result.current.left).toBe(80);
    });

    test("should fall back to menuWidth option when offsetWidth is 0", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 140,
        left: 100,
        right: 300,
        width: 200,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 100,
      });

      Object.defineProperty(mockMenuElement, "offsetWidth", {
        writable: true,
        configurable: true,
        value: 0,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true, { menuWidth: 250 })
      );

      // left should be: right (300) - fallback menuWidth (250) = 50
      expect(result.current.left).toBe(50);
    });

    test("should prefer offsetWidth over explicit menuWidth option", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 140,
        left: 100,
        right: 300,
        width: 200,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      Object.defineProperty(mockMenuElement, "offsetHeight", {
        writable: true,
        configurable: true,
        value: 100,
      });

      Object.defineProperty(mockMenuElement, "offsetWidth", {
        writable: true,
        configurable: true,
        value: 180,
      });

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, mockMenuRef, true, { menuWidth: 250 })
      );

      // left should be: right (300) - offsetWidth (180) = 120, NOT 300 - 250 = 50
      expect(result.current.left).toBe(120);
    });
  });

  describe("Edge cases with refs", () => {
    test("should handle null buttonRef gracefully", () => {
      const nullButtonRef: RefObject<HTMLButtonElement | null> = {
        current: null,
      };

      const { result } = renderHook(() =>
        useDropdownPosition(nullButtonRef, mockMenuRef, true)
      );

      // Should return initial position without crashing
      expect(result.current).toEqual({ top: 0, left: 0 });
    });

    test("should handle null menuRef gracefully", () => {
      vi.spyOn(mockButtonElement, "getBoundingClientRect").mockReturnValue({
        top: 100,
        bottom: 140,
        left: 100,
        right: 200,
        width: 100,
        height: 40,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      });

      const nullMenuRef: RefObject<HTMLDivElement | null> = { current: null };

      const { result } = renderHook(() =>
        useDropdownPosition(mockButtonRef, nullMenuRef, true)
      );

      // Should treat menu height as 0 and position below temporarily
      expect(result.current.top).toBe(144); // 140 + 4
      expect(result.current.left).toBe(8);
    });
  });
});
