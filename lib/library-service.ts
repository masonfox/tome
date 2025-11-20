export interface LibraryFilters {
  status?: string;
  search?: string;
  tags?: string[];
  rating?: string;
  pagination: {
    limit: number;
    skip: number;
  };
  showOrphaned?: boolean;
  sortBy?: string;
}

export interface PaginatedBooks {
  books: BookWithStatus[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

export interface BookWithStatus {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  coverPath?: string;
  status: string | null;
  rating?: number | null;
  tags: string[];
  totalPages?: number;
  latestProgress?: {
    currentPage: number;
    currentPercentage: number;
    progressDate: string;
  };
}

export class LibraryService {
  private cache = new Map<string, PaginatedBooks>();
  private tagsCache: string[] | null = null;

  private buildCacheKey(filters: LibraryFilters): string {
    return JSON.stringify({
      status: filters.status,
      search: filters.search,
      tags: filters.tags?.sort(),
      rating: filters.rating,
      limit: filters.pagination.limit,
      skip: filters.pagination.skip,
      showOrphaned: filters.showOrphaned,
      sortBy: filters.sortBy,
    });
  }

  async getBooks(filters: LibraryFilters): Promise<PaginatedBooks> {
    const cacheKey = this.buildCacheKey(filters);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const { status, search, tags, rating, pagination, showOrphaned } = filters;
      const { limit, skip } = pagination;

      // Build query params for API call
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (search) params.set("search", search);
      if (tags && tags.length > 0) params.set("tags", tags.join(","));
      if (rating && rating !== "all") params.set("rating", rating);
      if (showOrphaned) params.set("showOrphaned", "true");
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      params.set("limit", limit.toString());
      params.set("skip", skip.toString());

      // Call the API route
      const response = await fetch(`/api/books?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const result: PaginatedBooks = {
        books: data.books || [],
        total: data.total || 0,
        limit,
        skip,
        hasMore: skip + (data.books?.length || 0) < (data.total || 0),
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error("LibraryService: Failed to fetch books:", error);
      throw new Error("Failed to fetch books");
    }
  }

  async getAvailableTags(): Promise<string[]> {
    // Check cache first
    if (this.tagsCache) {
      return this.tagsCache;
    }

    try {
      const response = await fetch("/api/tags");
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const sortedTags = (data.tags || []).sort((a: string, b: string) => a.localeCompare(b));

      // Cache the result
      this.tagsCache = sortedTags;

      return sortedTags;
    } catch (error) {
      console.error("LibraryService: Failed to fetch tags:", error);
      throw new Error("Failed to fetch tags");
    }
  }

  async syncCalibre(): Promise<any> {
    try {
      const response = await fetch("/api/calibre/sync", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Clear cache after sync
      this.clearCache();

      return result;
    } catch (error) {
      console.error("LibraryService: Failed to sync Calibre:", error);
      throw new Error("Failed to sync with Calibre");
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.tagsCache = null;
  }

  // Utility method to invalidate specific cache entries
  invalidateCache(filters: Partial<LibraryFilters>): void {
    const keysToDelete: string[] = [];
    
    for (const [key] of Array.from(this.cache.entries())) {
      const cachedFilters = JSON.parse(key);
      
      // Invalidate if filters overlap significantly
      if (
        (filters.status && cachedFilters.status !== filters.status) ||
        (filters.search && cachedFilters.search !== filters.search) ||
        (filters.tags && 
          (!cachedFilters.tags || 
           !filters.tags!.every(tag => cachedFilters.tags.includes(tag))))
      ) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Singleton instance for app-wide usage
export const libraryService = new LibraryService();