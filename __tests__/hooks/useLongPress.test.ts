import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLongPress } from "@/hooks/useLongPress";

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Basic Functionality", () => {
    it("should return event handlers", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      expect(result.current).toHaveProperty("onMouseDown");
      expect(result.current).toHaveProperty("onMouseUp");
      expect(result.current).toHaveProperty("onMouseLeave");
      expect(result.current).toHaveProperty("onMouseMove");
      expect(result.current).toHaveProperty("onTouchStart");
      expect(result.current).toHaveProperty("onTouchEnd");
      expect(result.current).toHaveProperty("onTouchMove");
    });

    it("should use default delay and tolerance", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      const mockEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(499);
      });
      expect(onLongPress).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it("should accept custom delay and tolerance", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 1000, tolerance: 20 })
      );

      const mockEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(999);
      });
      expect(onLongPress).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Mouse Events", () => {
    it("should trigger callback after delay on mouse down", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      const mockEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it("should only respond to left mouse button", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      // Right-click (button = 2)
      const rightClickEvent = {
        button: 2,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(rightClickEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should cancel on mouse up before delay", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      const mockEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      act(() => {
        result.current.onMouseUp();
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should cancel on mouse leave", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      const mockEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      act(() => {
        result.current.onMouseLeave();
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should cancel on movement beyond tolerance", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, tolerance: 10 })
      );

      const startEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(startEvent);
      });

      // Move beyond tolerance (> 10px)
      const moveEvent = {
        clientX: 112,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseMove(moveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should NOT cancel on movement within tolerance", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, tolerance: 10 })
      );

      const startEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(startEvent);
      });

      // Move within tolerance (< 10px)
      const moveEvent = {
        clientX: 105,
        clientY: 103,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseMove(moveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Touch Events", () => {
    it("should trigger callback after delay on touch start", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      const mockEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it("should ignore multi-touch events", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      const mockEvent = {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should cancel on touch end before delay", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      const mockEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchStart(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      act(() => {
        result.current.onTouchEnd();
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should cancel on touch move beyond tolerance", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, tolerance: 10 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchStart(startEvent);
      });

      // Move beyond tolerance (> 10px)
      const moveEvent = {
        touches: [{ clientX: 100, clientY: 112 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchMove(moveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should NOT cancel on touch move within tolerance", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, tolerance: 10 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchStart(startEvent);
      });

      // Move within tolerance (< 10px)
      const moveEvent = {
        touches: [{ clientX: 105, clientY: 103 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchMove(moveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it("should ignore touch move with multiple touches", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, tolerance: 10 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchStart(startEvent);
      });

      // Multi-touch move
      const moveEvent = {
        touches: [
          { clientX: 105, clientY: 103 },
          { clientX: 200, clientY: 200 },
        ],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onTouchMove(moveEvent);
      });

      // Should still trigger because multi-touch move was ignored
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Memory Management", () => {
    it("should clear timeout on unmount", () => {
      const onLongPress = vi.fn();
      const { result, unmount } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500 })
      );

      const mockEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(mockEvent);
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Unmount before timeout completes
      unmount();

      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Callback should NOT fire after unmount
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should clear existing timeout when starting new long-press", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      const firstEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(firstEvent);
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Start a new long-press before first one completes
      const secondEvent = {
        button: 0,
        clientX: 200,
        clientY: 200,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(secondEvent);
      });

      act(() => {
        vi.advanceTimersByTime(250);
      });

      // First timeout should be cleared, so callback not fired yet
      expect(onLongPress).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Second timeout completes (total 500ms since second start)
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid press and release", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      const mockEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      // Rapid press and release 10 times
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.onMouseDown(mockEvent);
        });

        act(() => {
          vi.advanceTimersByTime(50);
        });

        act(() => {
          result.current.onMouseUp();
        });
      }

      // No callbacks should fire
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should not fire if no position set on move", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

      // Call onMouseMove without calling onMouseDown first
      const moveEvent = {
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseMove(moveEvent);
      });

      // Should not crash or cause issues
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("should handle movement exactly at tolerance boundary", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, tolerance: 10 })
      );

      const startEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(startEvent);
      });

      // Move exactly 10px (at boundary)
      const moveEvent = {
        clientX: 110,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseMove(moveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should NOT cancel (tolerance is exclusive)
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it("should handle diagonal movement correctly", () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, tolerance: 10 })
      );

      const startEvent = {
        button: 0,
        clientX: 100,
        clientY: 100,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseDown(startEvent);
      });

      // Diagonal move: 8px X, 8px Y (within tolerance individually but not combined)
      const moveEvent = {
        clientX: 108,
        clientY: 108,
      } as React.MouseEvent;

      act(() => {
        result.current.onMouseMove(moveEvent);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should still trigger (both deltas < 10)
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });
});
