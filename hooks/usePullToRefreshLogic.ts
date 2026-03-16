"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { usePathname } from "next/navigation";

/**
 * Hook that provides page-aware refresh logic for pull-to-refresh
 * Invalidates appropriate React Query caches based on current page
 */
export function usePullToRefreshLogic() {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const handleRefresh = useCallback(async () => {
    // Check if we're on a specific detail page
    const isBookDetail = pathname.startsWith("/books/");
    const isSeriesDetail = pathname.startsWith("/series/") && pathname !== "/series";
    const isShelfDetail = pathname.startsWith("/shelves/") && pathname !== "/shelves";

    if (isBookDetail) {
      // For book details, invalidate all book-related queries using base keys
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.book.base() }),
        // Note: Can't invalidate specific book progress/sessions without bookId
        // These will be invalidated by the specific mutations that need them
      ]);
    } else if (isSeriesDetail) {
      // For series detail pages
      await queryClient.invalidateQueries({ queryKey: queryKeys.series.all() });
    } else if (isShelfDetail) {
      // For shelf detail pages
      await queryClient.invalidateQueries({ queryKey: queryKeys.shelf.base() });
    } else {
      // Map pages to their query key invalidation
      const invalidationsByPath: Record<string, readonly unknown[]> = {
        "/": queryKeys.dashboard.all(),
        "/library": queryKeys.library.books(),
        "/read-next": queryKeys.readNext.base(),
        "/series": queryKeys.series.all(),
        "/stats": queryKeys.stats.all(),
        "/goals": queryKeys.goals.base(),
        "/streak": queryKeys.streak.base(),
        "/shelves": queryKeys.shelf.base(),
        "/tags": queryKeys.tags.base(),
        "/journal": ["journal-entries", "journal-archive"], // Invalidate both entries and archive
        "/settings": ["user-preferences"], // Settings page data
      };

      const queryKey = invalidationsByPath[pathname];
      
      if (queryKey) {
        await queryClient.invalidateQueries({ queryKey });
      } else {
        // Fallback: invalidate all queries if we don't have specific keys
        await queryClient.invalidateQueries();
      }
    }

    // Return a promise that resolves after invalidation
    return Promise.resolve();
  }, [pathname, queryClient]);

  return handleRefresh;
}
