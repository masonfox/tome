import { useLayoutEffect } from "react";

/**
 * Custom hook to set the page title
 * 
 * Sets the document title immediately on render (outside effects) and also
 * via useLayoutEffect to handle updates. This ensures the title is set as
 * early as possible during hydration to override the SSR'd default title.
 * 
 * @param title - The title to display after "Tome - ". 
 *                If undefined or empty string, shows just "Tome"
 */
export function usePageTitle(title?: string) {
  // Set title immediately on client-side to handle initial load
  if (typeof window !== 'undefined') {
    const newTitle = title ? `Tome - ${title}` : "Tome";
    if (document.title !== newTitle) {
      document.title = newTitle;
    }
  }

  // Also use useLayoutEffect to handle updates and ensure it persists
  useLayoutEffect(() => {
    if (title) {
      document.title = `Tome - ${title}`;
    } else {
      document.title = "Tome";
    }

    // Cleanup: reset to default on unmount
    return () => {
      document.title = "Tome";
    };
  }, [title]);
}
