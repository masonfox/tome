import { useState, useEffect, useLayoutEffect, useCallback, RefObject } from "react";

interface MenuPosition {
  top: number;
  left: number;
}

interface UseDropdownPositionOptions {
  /** Fallback width of the dropdown menu in pixels when DOM measurement is unavailable (default: 192 for w-48) */
  menuWidth?: number;
  /** Gap between the trigger button and menu in pixels (default: 4) */
  gap?: number;
}

/**
 * Custom hook for intelligent dropdown menu positioning that prevents overflow.
 * 
 * Automatically positions the menu above or below the trigger button based on
 * available viewport space. Handles edge cases like initial render with zero
 * height and menus that don't fit in either direction.
 * 
 * @param buttonRef - Ref to the trigger button element
 * @param menuRef - Ref to the dropdown menu element
 * @param isOpen - Whether the dropdown menu is currently visible
 * @param options - Configuration options for menu width and gap
 * @returns Menu position object with top and left coordinates
 * 
 * @example
 * ```tsx
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * const menuRef = useRef<HTMLDivElement>(null);
 * const [showMenu, setShowMenu] = useState(false);
 * 
 * const menuPosition = useDropdownPosition(buttonRef, menuRef, showMenu);
 * 
 * return (
 *   <>
 *     <button ref={buttonRef} onClick={() => setShowMenu(!showMenu)}>
 *       Toggle Menu
 *     </button>
 *     {showMenu && (
 *       <div ref={menuRef} style={{ top: menuPosition.top, left: menuPosition.left }}>
 *         Menu content
 *       </div>
 *     )}
 *   </>
 * );
 * ```
 */
export function useDropdownPosition(
  buttonRef: RefObject<HTMLButtonElement | null>,
  menuRef: RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  options: UseDropdownPositionOptions = {}
): MenuPosition {
  const { menuWidth = 192, gap = 4 } = options;
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();

    // Get menu dimensions (may be 0 on first render before content is measured)
    const menuHeight = menuRef.current?.offsetHeight || 0;
    const resolvedMenuWidth = menuRef.current?.offsetWidth || menuWidth;

    // If we don't have a height yet, position below temporarily
    // This will be recalculated in useLayoutEffect once menu renders
    if (menuHeight === 0) {
      setMenuPosition({
        top: rect.bottom + gap,
        left: rect.right - resolvedMenuWidth,
      });
      return;
    }

    // Calculate available space in viewport
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;

    // Smart positioning: choose above or below based on available space
    if (spaceBelow >= menuHeight + gap) {
      // Enough space below - position below button (default)
      top = rect.bottom + gap;
    } else if (spaceAbove >= menuHeight + gap) {
      // Not enough space below, but enough above - position above button
      top = rect.top - menuHeight - gap;
    } else {
      // Not enough space either way - use the side with more space
      // Ensure menu doesn't go above viewport top
      top = spaceBelow > spaceAbove
        ? rect.bottom + gap
        : Math.max(gap, rect.top - menuHeight - gap);
    }

    setMenuPosition({
      top,
      left: rect.right - resolvedMenuWidth,
    });
  }, [buttonRef, menuRef, menuWidth, gap]);

  // Update position when menu opens and while window is resized
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Initial position on open
    updateMenuPosition();

    // Recalculate position on window resize while menu is open
    const handleResize = () => {
      updateMenuPosition();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, updateMenuPosition]);

  // Recalculate position after menu renders to get accurate height
  // useLayoutEffect runs synchronously after DOM mutations but before paint
  useLayoutEffect(() => {
    if (isOpen && menuRef.current) {
      updateMenuPosition();
    }
  }, [isOpen, menuRef, updateMenuPosition]);

  return menuPosition;
}
