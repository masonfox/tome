import { useLayoutEffect } from "react";

/**
 * Custom hook to set the page title
 * 
 * IMPLEMENTATION NOTE - Render-time side effect:
 * This hook intentionally sets document.title during render (outside useLayoutEffect)
 * because Next.js 16 client components don't properly update titles on initial page
 * load when using effects alone. Without this immediate setting, titles don't render
 * at all on page refresh.
 * 
 * This violates React best practices (no side effects during render), but is a
 * necessary tradeoff because:
 * 1. Without it, titles don't work on initial load (functional requirement)
 * 2. document.title assignment is idempotent and safe
 * 3. Client-only guard prevents SSR issues
 * 4. Worst case in concurrent rendering: title set to correct value on next render
 * 
 * We also use useLayoutEffect for updates and cleanup to follow React patterns
 * where possible.
 * 
 * @param title - The title to display after "Tome - ". 
 *                If undefined or empty string, shows just "Tome"
 */
export function usePageTitle(title?: string) {
  // Compute title once to avoid duplication
  const newTitle = title ? `Tome - ${title}` : "Tome";
  
  // Set title immediately on client-side to handle initial load
  // This is necessary because useLayoutEffect alone doesn't work for initial render
  if (typeof window !== 'undefined' && document.title !== newTitle) {
    document.title = newTitle;
  }

  // Also use useLayoutEffect to handle updates and ensure it persists
  useLayoutEffect(() => {
    document.title = newTitle;

    // Cleanup: Only reset if title is still what this hook set
    // This prevents clobbering titles set by other components during route transitions
    return () => {
      if (document.title === newTitle) {
        document.title = "Tome";
      }
    };
  }, [newTitle]);
}
