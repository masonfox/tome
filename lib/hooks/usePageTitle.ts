import { useEffect } from "react";

/**
 * Custom hook to set the page title
 * @param title - The title to display after "Tome - ". If undefined, shows just "Tome"
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
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
