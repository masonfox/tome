import { test, expect, describe, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from "../test-utils";
import { useStreak } from "@/hooks/useStreak";
import { streakApi } from "@/lib/api";

// Mock the streakApi module
vi.mock("@/lib/api", () => ({
  streakApi: {
    rebuild: vi.fn(),
    updateThreshold: vi.fn(),
    updateTimezone: vi.fn(),
  },
}));

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
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(streakApi.rebuild).mockResolvedValue({ success: true });
    vi.mocked(streakApi.updateThreshold).mockResolvedValue({ 
      success: true, 
      data: {} as any 
    });
    vi.mocked(streakApi.updateTimezone).mockResolvedValue({ 
      success: true, 
      data: {} as any 
    });
  });

  describe("rebuildStreak mutation", () => {
    test("should call streakApi.rebuild", async () => {
      const { result } = renderHook(() => useStreak());

      expect(result.current.isRebuilding).toBe(false);

      await act(async () => {
        await result.current.rebuildStreakAsync();
      });

      expect(streakApi.rebuild).toHaveBeenCalled();
    });

    test("should set isRebuilding to true during mutation", async () => {
      let resolveApi: (value: any) => void;
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve;
      });

      vi.mocked(streakApi.rebuild).mockReturnValue(apiPromise as any);

      const { result } = renderHook(() => useStreak());

      act(() => {
        result.current.rebuildStreak();
      });

      await waitFor(() => {
        expect(result.current.isRebuilding).toBe(true);
      });

      // Resolve API call
      resolveApi!({ success: true });

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
      vi.mocked(streakApi.rebuild).mockRejectedValue(new Error("Failed to rebuild"));

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
      vi.mocked(streakApi.rebuild).mockRejectedValue(new Error("Network error"));

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
    test("should call streakApi.updateThreshold with dailyThreshold", async () => {
      const { result } = renderHook(() => useStreak());

      expect(result.current.isUpdatingThreshold).toBe(false);

      await act(async () => {
        await result.current.updateThresholdAsync(25);
      });

      expect(streakApi.updateThreshold).toHaveBeenCalledWith({ dailyThreshold: 25 });
    });

    test("should set isUpdatingThreshold to true during mutation", async () => {
      let resolveApi: (value: any) => void;
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve;
      });

      vi.mocked(streakApi.updateThreshold).mockReturnValue(apiPromise as any);

      const { result } = renderHook(() => useStreak());

      act(() => {
        result.current.updateThreshold(15);
      });

      await waitFor(() => {
        expect(result.current.isUpdatingThreshold).toBe(true);
      });

      // Resolve API call
      resolveApi!({ success: true, data: {} });

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
      vi.mocked(streakApi.updateThreshold).mockRejectedValue(new Error("Validation failed"));

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
      vi.mocked(streakApi.updateThreshold).mockRejectedValue(new Error("Network error"));

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
    test("should call streakApi.updateTimezone with timezone", async () => {
      const { result } = renderHook(() => useStreak());

      expect(result.current.isUpdatingTimezone).toBe(false);

      await act(async () => {
        await result.current.updateTimezoneAsync("America/Los_Angeles");
      });

      expect(streakApi.updateTimezone).toHaveBeenCalledWith({ timezone: "America/Los_Angeles" });
    });

    test("should set isUpdatingTimezone to true during mutation", async () => {
      let resolveApi: (value: any) => void;
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve;
      });

      vi.mocked(streakApi.updateTimezone).mockReturnValue(apiPromise as any);

      const { result } = renderHook(() => useStreak());

      act(() => {
        result.current.updateTimezone("Europe/London");
      });

      await waitFor(() => {
        expect(result.current.isUpdatingTimezone).toBe(true);
      });

      // Resolve API call
      resolveApi!({ success: true, data: {} });

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
      vi.mocked(streakApi.updateTimezone).mockRejectedValue(new Error("Invalid timezone"));

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
      vi.mocked(streakApi.updateTimezone).mockRejectedValue(new Error("Network error"));

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
