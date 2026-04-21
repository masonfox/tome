/**
 * useLongPress Hook
 * 
 * Detects long-press gestures on touch and mouse events.
 * Used for entering select mode when user long-presses on a book list item.
 * 
 * @param onLongPress - Callback fired when long-press is detected
 * @param options - Configuration options
 * @returns Event handlers to spread onto target element
 */

import { useRef, useCallback, useEffect } from "react";

interface UseLongPressOptions {
  /** Delay in milliseconds before triggering long-press (default: 500) */
  delay?: number;
  /** Movement tolerance in pixels - if exceeded, cancels long-press (default: 10) */
  tolerance?: number;
}

interface Position {
  x: number;
  y: number;
}

export function useLongPress(
  onLongPress: () => void,
  options: UseLongPressOptions = {}
) {
  const { delay = 500, tolerance = 10 } = options;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<Position | null>(null);

  const start = useCallback(
    (x: number, y: number) => {
      startPosRef.current = { x, y };

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for long-press
      timeoutRef.current = setTimeout(() => {
        onLongPress();
        startPosRef.current = null;
      }, delay);
    },
    [onLongPress, delay]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const checkMovement = useCallback(
    (x: number, y: number) => {
      if (!startPosRef.current) return;

      const deltaX = Math.abs(x - startPosRef.current.x);
      const deltaY = Math.abs(y - startPosRef.current.y);

      // If movement exceeds tolerance, cancel long-press
      if (deltaX > tolerance || deltaY > tolerance) {
        cancel();
      }
    },
    [tolerance, cancel]
  );

  // Mouse event handlers
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only respond to left mouse button
      if (e.button !== 0) return;
      start(e.clientX, e.clientY);
    },
    [start]
  );

  const onMouseUp = useCallback(() => {
    cancel();
  }, [cancel]);

  const onMouseLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      checkMovement(e.clientX, e.clientY);
    },
    [checkMovement]
  );

  // Touch event handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return; // Only single-touch
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    [start]
  );

  const onTouchEnd = useCallback(() => {
    cancel();
  }, [cancel]);

  const onTouchCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      checkMovement(touch.clientX, touch.clientY);
    },
    [checkMovement]
  );

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onMouseMove,
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    onTouchMove,
  };
}
