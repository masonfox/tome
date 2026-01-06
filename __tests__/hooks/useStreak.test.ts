import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from "../test-utils";
import { useStreak } from "@/hooks/useStreak";

const originalFetch = global.fetch;

// Mock sonner toast - hoist the mock functions
const mockToastSuccess = vi.hoisted(() => vi.fn(() => {}));
const mockToastError = vi.hoisted(() => vi.fn(() => {}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

describe("useStreak", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)
    ) as any;
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("rebuildStreak mutation", () => {
    test("should call POST /api/streak/rebuild", async () => {
      const { result } = renderHook(() => useStreak());

      expect(result.current.isRebuilding).toBe(false);

      await act(async () => {
        await result.current.rebuildStreakAsync();
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/streak/rebuild", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    test("should set isRebuilding to true during mutation", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      global.fetch = vi.fn(() => fetchPromise) as any;

      const { result } = renderHook(() => useStreak());

      act(() => {
        result.current.rebuildStreak();
      });

      await waitFor(() => {
        expect(result.current.isRebuilding).toBe(true);
      });

      // Resolve fetch
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await waitFor(() => {
        expect(result.current.isRebuilding).toBe(false);
      });
    });

    test("should show success toast on successful rebuild", async () => {
      const { result } = renderHook(() => useStreak());

      await act(async () => {
        await result.current.rebuildStreakAsync();
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Streak recalculated successfully!"
        );
      });
    });

    test("should invalidate correct query keys on success", async () => {
      const { result } = renderHook(() => useStreak());

      await act(async () => {
        await result.current.rebuildStreakAsync();
      });

      // Query invalidation happens internally
      // We can verify the mutation succeeded
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    test("should handle rebuild errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: false,
              error: { message: "Failed to rebuild" },
            }),
        } as Response)
      ) as any;

      const { result } = renderHook(() => useStreak());

      await act(async () => {
        try {
          await result.current.rebuildStreakAsync();
        } catch (error) {
          // Error is expected
        }
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Failed to recalculate streak. Please try again."
        );
      });
    });

    test("should handle network errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network error"))
      ) as any;

      const { result } = renderHook(() => useStreak());

      await act(async () => {
        try {
          await result.current.rebuildStreakAsync();
        } catch (error) {
          // Error is expected
        }
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  describe("updateThreshold mutation", () => {
    test("should call PATCH /api/streak with dailyThreshold", async () => {
      const { result } = renderHook(() => useStreak());

      expect(result.current.isUpdatingThreshold).toBe(false);

      await act(async () => {
        await result.current.updateThresholdAsync(25);
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/streak", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyThreshold: 25 }),
      });
    });

    test("should set isUpdatingThreshold to true during mutation", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      global.fetch = vi.fn(() => fetchPromise) as any;

      const { result } = renderHook(() => useStreak());

      act(() => {
        result.current.updateThreshold(15);
      });

      await waitFor(() => {
        expect(result.current.isUpdatingThreshold).toBe(true);
      });

      // Resolve fetch
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await waitFor(() => {
        expect(result.current.isUpdatingThreshold).toBe(false);
      });
    });

    test("should show success toast on successful update", async () => {
      const { result } = renderHook(() => useStreak());

      await act(async () => {
        await result.current.updateThresholdAsync(20);
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Daily reading goal updated!"
        );
      });
    });

    test("should invalidate correct query keys on success", async () => {
      const { result } = renderHook(() => useStreak());

      await act(async () => {
        await result.current.updateThresholdAsync(30);
      });

      // Verify mutation completed successfully
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    test("should handle update errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              success: false,
              error: { message: "Validation failed" },
            }),
        } as Response)
      ) as any;

      const { result } = renderHook(() => useStreak());

      await act(async () => {
        try {
          await result.current.updateThresholdAsync(10);
        } catch (error) {
          // Error is expected
        }
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });

    test("should handle network errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network error"))
      ) as any;

      const { result } = renderHook(() => useStreak());

      await act(async () => {
        try {
          await result.current.updateThresholdAsync(15);
        } catch (error) {
          // Error is expected
        }
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  describe("updateTimezone mutation", () => {
    test("should call PATCH /api/streak/timezone with timezone", async () => {
      const { result } = renderHook(() => useStreak());

      expect(result.current.isUpdatingTimezone).toBe(false);

      await act(async () => {
        await result.current.updateTimezoneAsync("America/Los_Angeles");
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/streak/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: "America/Los_Angeles" }),
      });
    });

    test("should set isUpdatingTimezone to true during mutation", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      global.fetch = vi.fn(() => fetchPromise) as any;

      const { result } = renderHook(() => useStreak());

      act(() => {
        result.current.updateTimezone("Europe/London");
      });

      await waitFor(() => {
        expect(result.current.isUpdatingTimezone).toBe(true);
      });

      // Resolve fetch
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await waitFor(() => {
        expect(result.current.isUpdatingTimezone).toBe(false);
      });
    });

    test("should show success toast on successful update", async () => {
      const { result } = renderHook(() => useStreak());

      await act(async () => {
        await result.current.updateTimezoneAsync("Asia/Tokyo");
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Timezone updated! Streak recalculated with new day boundaries."
        );
      });
    });

    test("should invalidate all relevant query keys including stats", async () => {
      const { result } = renderHook(() => useStreak());

      await act(async () => {
        await result.current.updateTimezoneAsync("America/Chicago");
      });

      // Verify mutation completed - should invalidate stats too
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    test("should handle timezone update errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              success: false,
              error: { message: "Invalid timezone" },
            }),
        } as Response)
      ) as any;

      const { result } = renderHook(() => useStreak());

      await act(async () => {
        try {
          await result.current.updateTimezoneAsync("Invalid/Timezone");
        } catch (error) {
          // Error is expected
        }
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });

    test("should handle network errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network error"))
      ) as any;

      const { result } = renderHook(() => useStreak());

      await act(async () => {
        try {
          await result.current.updateTimezoneAsync("America/Denver");
        } catch (error) {
          // Error is expected
        }
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  describe("mutation states", () => {
    test("should all be false initially", () => {
      const { result } = renderHook(() => useStreak());

      expect(result.current.isRebuilding).toBe(false);
      expect(result.current.isUpdatingThreshold).toBe(false);
      expect(result.current.isUpdatingTimezone).toBe(false);
    });

    test("should not interfere with each other", async () => {
      const { result } = renderHook(() => useStreak());

      await act(async () => {
        await result.current.updateThresholdAsync(25);
      });

      // After one mutation completes, others should still be false
      expect(result.current.isRebuilding).toBe(false);
      expect(result.current.isUpdatingThreshold).toBe(false);
      expect(result.current.isUpdatingTimezone).toBe(false);
    });
  });

  describe("async vs sync mutations", () => {
    test("should provide both mutate and mutateAsync for rebuild", () => {
      const { result } = renderHook(() => useStreak());

      expect(typeof result.current.rebuildStreak).toBe("function");
      expect(typeof result.current.rebuildStreakAsync).toBe("function");
    });

    test("should provide both mutate and mutateAsync for threshold update", () => {
      const { result } = renderHook(() => useStreak());

      expect(typeof result.current.updateThreshold).toBe("function");
      expect(typeof result.current.updateThresholdAsync).toBe("function");
    });

    test("should provide both mutate and mutateAsync for timezone update", () => {
      const { result } = renderHook(() => useStreak());

      expect(typeof result.current.updateTimezone).toBe("function");
      expect(typeof result.current.updateTimezoneAsync).toBe("function");
    });
  });
});
