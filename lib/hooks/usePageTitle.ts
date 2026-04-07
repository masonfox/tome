import { useLayoutEffect, useEffect } from "react";

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
 * HYDRATION FIX:
 * Next.js 16 server-renders <title> from metadata, then React hydration overwrites
 * any client-side title changes to match the server HTML. We use a MutationObserver
 * to detect and correct this hydration overwrite, ensuring client-side titles persist.
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

  // Watch for external title changes (primarily React hydration overwriting our title)
  // This fixes the issue where hard refresh causes title to revert to "Tome"
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const observer = new MutationObserver(() => {
      if (document.title !== newTitle) {
        // React hydration or another process changed the title - restore it
        document.title = newTitle;
      }
    });
    
    const titleElement = document.querySelector('title');
    if (titleElement) {
      observer.observe(titleElement, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
    
    return () => observer.disconnect();
  }, [newTitle]);

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
