"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

/**
 * Hook that provides page-aware refresh logic for pull-to-refresh
 * Invalidates appropriate React Query caches based on current page
 */
export function usePullToRefreshLogic() {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const handleRefresh = useCallback(async () => {
    // Map pages to their query keys
    const pageQueryMap: Record<string, string[]> = {
      "/": ["dashboard"],
      "/library": ["library", "libraryStats"],
      "/read-next": ["readNext"],
      "/series": ["series"],
      "/stats": ["stats"],
      "/goals": ["goals"],
      "/streak": ["streak"],
      "/journal": ["sessions"],
      "/shelves": ["shelves"],
      "/tags": ["tags"],
      "/settings": ["settings"],
    };

    // Check if we're on a book detail page
    const isBookDetail = pathname.startsWith("/books/");
    const isSeriesDetail = pathname.startsWith("/series/") && pathname !== "/series";
    const isShelfDetail = pathname.startsWith("/shelves/") && pathname !== "/shelves";

    let queryKeys: string[] = [];

    if (isBookDetail) {
      // For book details, invalidate book-related queries
      queryKeys = ["book", "bookProgress", "bookSessions", "bookTags", "bookShelves"];
    } else if (isSeriesDetail) {
      // For series detail pages
      queryKeys = ["series", "seriesBooks"];
    } else if (isShelfDetail) {
      // For shelf detail pages
      queryKeys = ["shelf", "shelfBooks"];
    } else {
      // Find matching page in the map
      queryKeys = pageQueryMap[pathname] || [];
    }

    // Invalidate queries
    if (queryKeys.length > 0) {
      await Promise.all(
        queryKeys.map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        )
      );
    } else {
      // Fallback: invalidate all queries if we don't have specific keys
      await queryClient.invalidateQueries();
    }

    // Return a promise that resolves after invalidation
    return Promise.resolve();
  }, [pathname, queryClient]);

  return handleRefresh;
}
