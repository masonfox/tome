import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { usePageTitle } from "@/lib/hooks/usePageTitle";

describe("usePageTitle", () => {
  let originalTitle: string;

  beforeEach(() => {
    // Save original title
    originalTitle = document.title;
  });

  afterEach(() => {
    // Restore original title
    document.title = originalTitle;
  });

  describe("basic functionality", () => {
    it("should set document title with 'Tome - ' prefix when title is provided", () => {
      renderHook(() => usePageTitle("Dashboard"));

      expect(document.title).toBe("Tome - Dashboard");
    });

    it("should set document title to 'Tome' when title is undefined", () => {
      renderHook(() => usePageTitle(undefined));

      expect(document.title).toBe("Tome");
    });

    it("should set document title to 'Tome' when title is empty string", () => {
      renderHook(() => usePageTitle(""));

      expect(document.title).toBe("Tome");
    });

    it("should handle complex titles with special characters", () => {
      renderHook(() => usePageTitle("The Lord of the Rings by J.R.R. Tolkien"));

      expect(document.title).toBe("Tome - The Lord of the Rings by J.R.R. Tolkien");
    });
  });

  describe("title updates", () => {
    it("should update document title when title prop changes", () => {
      const { rerender } = renderHook(({ title }: { title?: string }) => usePageTitle(title), {
        initialProps: { title: "Dashboard" as string | undefined },
      });

      expect(document.title).toBe("Tome - Dashboard");

      rerender({ title: "Library" });

      expect(document.title).toBe("Tome - Library");
    });

    it("should update from defined to undefined", () => {
      const { rerender } = renderHook(({ title }: { title?: string }) => usePageTitle(title), {
        initialProps: { title: "Dashboard" as string | undefined },
      });

      expect(document.title).toBe("Tome - Dashboard");

      rerender({ title: undefined });

      expect(document.title).toBe("Tome");
    });

    it("should update from undefined to defined", () => {
      const { rerender } = renderHook(({ title }: { title?: string }) => usePageTitle(title), {
        initialProps: { title: undefined as string | undefined },
      });

      expect(document.title).toBe("Tome");

      rerender({ title: "Dashboard" });

      expect(document.title).toBe("Tome - Dashboard");
    });
  });

  describe("cleanup behavior", () => {
    it("should reset document title to 'Tome' on unmount", () => {
      const { unmount } = renderHook(() => usePageTitle("Dashboard"));

      expect(document.title).toBe("Tome - Dashboard");

      unmount();

      expect(document.title).toBe("Tome");
    });

    it("should reset to 'Tome' even when title was undefined", () => {
      const { unmount } = renderHook(() => usePageTitle(undefined));

      expect(document.title).toBe("Tome");

      unmount();

      expect(document.title).toBe("Tome");
    });

    it("should not interfere with subsequent renders", () => {
      // First hook
      const { unmount: unmount1 } = renderHook(() => usePageTitle("Dashboard"));
      expect(document.title).toBe("Tome - Dashboard");
      unmount1();
      expect(document.title).toBe("Tome");

      // Second hook
      const { unmount: unmount2 } = renderHook(() => usePageTitle("Library"));
      expect(document.title).toBe("Tome - Library");
      unmount2();
      expect(document.title).toBe("Tome");
    });
  });

  describe("edge cases", () => {
    it("should handle titles with 'Tome - ' already in them", () => {
      renderHook(() => usePageTitle("Tome - Dashboard"));

      // Should add prefix anyway (resulting in double prefix)
      // This is expected behavior - the hook doesn't check for existing prefix
      expect(document.title).toBe("Tome - Tome - Dashboard");
    });

    it("should handle very long titles", () => {
      const longTitle = "A".repeat(500);
      renderHook(() => usePageTitle(longTitle));

      expect(document.title).toBe(`Tome - ${longTitle}`);
    });

    it("should handle titles with newlines and whitespace", () => {
      renderHook(() => usePageTitle("Dashboard\nwith\nnewlines"));

      expect(document.title).toBe("Tome - Dashboard\nwith\nnewlines");
    });

    it("should handle titles with unicode characters", () => {
      renderHook(() => usePageTitle("📚 Dashboard 📖"));

      expect(document.title).toBe("Tome - 📚 Dashboard 📖");
    });
  });

  describe("multiple instances", () => {
    it("should handle multiple hooks updating the same document title", () => {
      const { rerender: rerender1 } = renderHook(
        ({ title }: { title?: string }) => usePageTitle(title),
        { initialProps: { title: "Dashboard" as string | undefined } }
      );

      expect(document.title).toBe("Tome - Dashboard");

      // Second hook overrides the first
      const { rerender: rerender2 } = renderHook(
        ({ title }: { title?: string }) => usePageTitle(title),
        { initialProps: { title: "Library" as string | undefined } }
      );

      expect(document.title).toBe("Tome - Library");

      // Update first hook - title gets overridden again
      rerender1({ title: "Settings" });

      // Last effect to run wins (this is expected React behavior)
      expect(document.title).toBe("Tome - Settings");
    });
  });

  describe("loading states", () => {
    it("should simulate loading state (undefined -> defined)", () => {
      // Simulate a component that loads data
      const { rerender } = renderHook(({ title }: { title?: string }) => usePageTitle(title), {
        initialProps: { title: undefined as string | undefined },
      });

      // Initially shows "Tome" (loading)
      expect(document.title).toBe("Tome");

      // After data loads, shows full title
      rerender({ title: "The Fellowship of the Ring by J.R.R. Tolkien" });
      expect(document.title).toBe("Tome - The Fellowship of the Ring by J.R.R. Tolkien");
    });

    it("should handle error state (defined -> undefined)", () => {
      const { rerender } = renderHook(({ title }: { title?: string }) => usePageTitle(title), {
        initialProps: { title: "Dashboard" as string | undefined },
      });

      expect(document.title).toBe("Tome - Dashboard");

      // Error occurs, falls back to undefined
      rerender({ title: undefined });
      expect(document.title).toBe("Tome");
    });
  });

  // NOTE: MutationObserver tests are difficult to implement in happy-dom test environment
  // because MutationObserver callbacks don't fire consistently. The MutationObserver
  // in usePageTitle.ts (lines 45-50) handles React hydration edge cases where Next.js
  // server-rendered titles get overwritten by client-side rendering. This is tested
  // manually and works correctly in production browsers.
});
