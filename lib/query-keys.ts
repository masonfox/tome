/**
 * Centralized Query Key Factory
 * 
 * This file provides type-safe, collision-resistant query keys for React Query.
 * 
 * ## Benefits
 * 
 * - **Prevents key collisions**: Hierarchical organization ensures unique keys
 * - **Type safety**: Compile-time checks catch typos and invalid parameters
 * - **Centralized management**: Easier refactoring and maintenance
 * - **Consistent invalidation**: Base keys enable wildcard invalidation
 * 
 * ## Usage Examples
 * 
 * ### In Queries
 * ```typescript
 * import { queryKeys } from '@/lib/query-keys';
 * 
 * // Fetch a specific book
 * useQuery({
 *   queryKey: queryKeys.book.detail(bookId),
 *   queryFn: () => bookApi.get(bookId)
 * });
 * 
 * // Fetch streak analytics
 * useQuery({
 *   queryKey: queryKeys.streak.analytics(7),
 *   queryFn: () => fetch('/api/streak/analytics?days=7')
 * });
 * ```
 * 
 * ### In Invalidations
 * ```typescript
 * // Invalidate a specific book
 * queryClient.invalidateQueries({ 
 *   queryKey: queryKeys.book.detail(bookId) 
 * });
 * 
 * // Invalidate ALL book queries (wildcard)
 * queryClient.invalidateQueries({ 
 *   queryKey: queryKeys.book.base() 
 * });
 * 
 * // Invalidate all streak queries (fixes critical bug in useStreak.ts)
 * queryClient.invalidateQueries({ 
 *   queryKey: queryKeys.streak.base() 
 * });
 * ```
 * 
 * ## Bug Fixes
 * 
 * This factory addresses critical bugs:
 * 
 * 1. **Invalidation Bug** (useStreak.ts): Was invalidating `['streak-analytics']` 
 *    but actual key was `['streak-analytics-full', 7]`. Now uses `queryKeys.streak.base()`.
 * 
 * 2. **Collision Bug** (PR #395): Two components used `'streak-analytics'` with different 
 *    data structures. Now uses hierarchical keys: `queryKeys.streak.analytics(7)` vs 
 *    `queryKeys.streak.heatmap(365)`.
 * 
 * ## Key Structure
 * 
 * Keys follow a hierarchical pattern:
 * - `['book']` - Base key for all books (wildcard invalidation)
 * - `['book', id]` - Specific book detail
 * - `['streak', 'analytics', days]` - Streak analytics with specific period
 * - `['streak', 'analytics', 'heatmap', days]` - Heatmap (distinct from analytics)
 * 
 * @see {@link https://tkdodo.eu/blog/effective-react-query-keys} - TanStack Query key best practices
 */

/**
 * Valid time periods for analytics queries
 */
export type AnalyticsDays = 7 | 30 | 90 | 180 | 365 | "this-year" | "all-time";

export const queryKeys = {
  // ============================================================================
  // BOOKS
  // ============================================================================
  book: {
    /** Base key for all book queries: ['book'] */
    base: () => ['book'] as const,
    
    /** Book detail by ID: ['book', id] */
    detail: (id: number) => ['book', id] as const,
    
    /** Available tags for books: ['availableTags'] */
    availableTags: () => ['availableTags'] as const,
    
    /** Available shelves for books: ['availableShelves'] */
    availableShelves: () => ['availableShelves'] as const,
    
    /** Shelves for a specific book: ['bookShelves', bookId] */
    shelves: (bookId: number) => ['bookShelves', bookId] as const,
  },

  // ============================================================================
  // LIBRARY
  // ============================================================================
  library: {
    /** Library books list: ['library-books'] */
    books: () => ['library-books'] as const,
  },

  // ============================================================================
  // SESSIONS
  // ============================================================================
  sessions: {
    /** Sessions for a specific book: ['sessions', bookId] */
    byBook: (bookId: number) => ['sessions', bookId] as const,
    
    /** Progress entries for a specific session: ['session-progress', sessionId] */
    progress: (sessionId: number) => ['session-progress', sessionId] as const,
  },

  // ============================================================================
  // PROGRESS
  // ============================================================================
  progress: {
    /** Progress for a specific book: ['progress', bookId] */
    byBook: (bookId: number) => ['progress', bookId] as const,
  },

  // ============================================================================
  // STREAK
  // ============================================================================
  streak: {
    /** Base key for all streak queries: ['streak'] */
    base: () => ['streak'] as const,
    
    /** Streak settings and status: ['streak', 'settings'] */
    settings: () => ['streak', 'settings'] as const,
    
    /** Streak analytics for daily chart: ['streak', 'analytics', days] */
    analytics: (days: AnalyticsDays) => ['streak', 'analytics', days] as const,
    
    /** Streak heatmap data: ['streak', 'analytics', 'heatmap', days] */
    heatmap: (days: 7 | 30 | 90 | 180 | 365) => ['streak', 'analytics', 'heatmap', days] as const,
  },

  // ============================================================================
  // GOALS
  // ============================================================================
  goals: {
    /** Base key for all goal queries: ['goals'] */
    base: () => ['goals'] as const,
    
    /** Reading goal for specific year: ['reading-goal', year] */
    byYear: (year: number) => ['reading-goal', year] as const,
    
    /** Monthly breakdown for specific year: ['monthly-breakdown', year] */
    monthlyBreakdown: (year: number) => ['monthly-breakdown', year] as const,
    
    /** Completed books for specific year: ['completed-books', year] */
    completedBooks: (year: number) => ['completed-books', year] as const,
  },

  // ============================================================================
  // SHELVES
  // ============================================================================
  shelf: {
    /** Base key for all shelf queries: ['shelf'] */
    base: () => ['shelf'] as const,
    
    /** Shelf by ID (for invalidation/cancellation): ['shelf', id] */
    byId: (id: number) => ['shelf', id] as const,
    
    /** Shelf detail with books and sorting: ['shelf', id, 'books', options] */
    detail: (id: number, options: { orderBy?: string; direction?: string }) => 
      ['shelf', id, 'books', options] as const,
  },

  // ============================================================================
  // SERIES
  // ============================================================================
  series: {
    /** All series: ['series'] */
    all: () => ['series'] as const,
    
    /** Series detail by name: ['series', name] */
    detail: (name: string) => ['series', name] as const,
  },

  // ============================================================================
  // READ NEXT
  // ============================================================================
  readNext: {
    /** Base key for read next queries: ['read-next-books'] */
    base: () => ['read-next-books'] as const,
    
    /** Read next books with optional search: ['read-next-books', search] */
    books: (search?: string) => ['read-next-books', search] as const,
  },

  // ============================================================================
  // JOURNAL
  // ============================================================================
  journal: {
    /** Base key for journal entries (prefix matching): ['journal-entries'] */
    entriesBase: () => ['journal-entries'] as const,
    
    /** Base key for journal archive (prefix matching): ['journal-archive'] */
    archiveBase: () => ['journal-archive'] as const,
    
    /** Journal entries for timezone: ['journal-entries', timezone] */
    entries: (timezone: string) => ['journal-entries', timezone] as const,
    
    /** Journal archive for timezone: ['journal-archive', timezone] */
    archive: (timezone: string) => ['journal-archive', timezone] as const,
  },

  // ============================================================================
  // TAGS
  // ============================================================================
  tags: {
    /** Base key for all tag queries: ['tags'] */
    base: () => ['tags'] as const,
    
    /** Books for a specific tag: ['tag-books', tagId] */
    books: (tagId: number) => ['tag-books', tagId] as const,
  },

  // ============================================================================
  // DASHBOARD
  // ============================================================================
  dashboard: {
    /** Dashboard data: ['dashboard'] */
    all: () => ['dashboard'] as const,
  },

  // ============================================================================
  // STATS
  // ============================================================================
  stats: {
    /** Stats page data: ['stats'] */
    all: () => ['stats'] as const,
  },

  // ============================================================================
  // VERSION
  // ============================================================================
  version: {
    /** App version and update info: ['version'] */
    info: () => ['version'] as const,
  },
} as const;
