"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { BookCard } from "@/components/BookCard";
import { Search, Filter, RefreshCw, Library as LibraryIcon, X, Tag } from "lucide-react";
import { cn } from "@/utils/cn";

interface Book {
  _id: string;
  title: string;
  authors: string[];
  coverPath?: string;
  status: string | null;
  tags: string[];
}

const BOOKS_PER_PAGE = 50;

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalBooks, setTotalBooks] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Fetch available tags on mount
  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch("/api/tags");
        const data = await response.json();
        setAvailableTags(data.tags || []);
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      }
    }
    fetchTags();
  }, []);

  useEffect(() => {
    setBooks([]);
    setCurrentPage(0);
    setHasMore(true);
    fetchBooks(0);
  }, [statusFilter, search, selectedTags]);

  async function fetchBooks(page: number) {
    if (page === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (search) {
        params.set("search", search);
      }
      if (selectedTags.length > 0) {
        params.set("tags", selectedTags.join(","));
      }
      params.set("limit", BOOKS_PER_PAGE.toString());
      params.set("skip", (page * BOOKS_PER_PAGE).toString());

      const response = await fetch(`/api/books?${params.toString()}`);
      const data = await response.json();
      const newBooks = data.books || [];

      if (page === 0) {
        setBooks(newBooks);
        setTotalBooks(data.total || 0);
      } else {
        setBooks((prev) => [...prev, ...newBooks]);
      }

      setCurrentPage(page);
      setHasMore(newBooks.length === BOOKS_PER_PAGE);
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchBooks(currentPage + 1);
    }
  }, [currentPage, loadingMore, hasMore]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, loadingMore, loading]);

  async function syncCalibre() {
    setSyncing(true);
    try {
      const response = await fetch("/api/calibre/sync");
      const result = await response.json();

      if (result.success) {
        alert(result.message);
        setBooks([]);
        setCurrentPage(0);
        setHasMore(true);
        fetchBooks(0);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Failed to sync with Calibre");
    } finally {
      setSyncing(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setBooks([]);
    setCurrentPage(0);
    setHasMore(true);
    fetchBooks(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-5xl font-serif font-bold text-[var(--foreground)] flex items-center gap-3">
            <LibraryIcon className="w-8 h-8" />
            Library
          </h1>
          <p className="text-[var(--foreground)]/70 mt-2 font-light">
            {totalBooks} {totalBooks === 1 ? "book" : "books"}
          </p>
        </div>

        <button
          onClick={syncCalibre}
          disabled={syncing}
          className={cn(
            "flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white hover:bg-[var(--light-accent)] transition-colors font-semibold",
            syncing && "opacity-50 cursor-not-allowed"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync Calibre"}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-4">
        <form onSubmit={handleSearch} className="space-y-3">
          {/* Search and Status Filter Row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
                <input
                  type="text"
                  placeholder="Search books..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[var(--foreground)]/40" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="all">All Books</option>
                <option value="to-read">To Read</option>
                <option value="read-next">Read Next</option>
                <option value="reading">Reading</option>
                <option value="read">Read</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-6 py-2 bg-[var(--accent)] text-white hover:bg-[var(--light-accent)] transition-colors font-semibold"
            >
              Search
            </button>
          </div>

          {/* Tag Filter Row */}
          {availableTags.length > 0 && (
            <div className="flex gap-3 items-start">
              <div className="flex items-center gap-2 pt-2 shrink-0">
                <Tag className="w-5 h-5 text-[var(--foreground)]/40" />
              </div>

              <div className="flex-1 min-w-0">
                {/* Tag search input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearchInput}
                    onChange={(e) => {
                      setTagSearchInput(e.target.value);
                      setShowTagSuggestions(true);
                    }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => {
                      // Delay to allow clicking on suggestions
                      setTimeout(() => setShowTagSuggestions(false), 200);
                    }}
                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border-color)] text-[var(--foreground)] placeholder-[var(--foreground)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />

                  {/* Tag suggestions dropdown */}
                  {showTagSuggestions && tagSearchInput.trim() && (() => {
                    const filteredTags = availableTags
                      .filter((tag) =>
                        tag.toLowerCase().includes(tagSearchInput.toLowerCase()) &&
                        !selectedTags.includes(tag)
                      )
                      .slice(0, 15);

                    return filteredTags.length > 0 ? (
                      <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] max-h-60 overflow-y-auto shadow-lg">
                        {filteredTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setSelectedTags([...selectedTags, tag]);
                              setTagSearchInput("");
                              setShowTagSuggestions(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--foreground)]/50">
                        No matching tags found
                      </div>
                    );
                  })()}
                </div>
              </div>

              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="px-3 py-2 text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors shrink-0"
                >
                  Clear ({selectedTags.length})
                </button>
              )}
            </div>
          )}

          {/* Selected tags */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-9">
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                  className="px-3 py-1 text-sm bg-[var(--accent)] text-white border border-[var(--accent)] flex items-center gap-1 hover:bg-[var(--light-accent)] transition-colors"
                >
                  {tag}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Books Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[var(--foreground)]/70 mt-4 font-light">
            Loading books...
          </p>
        </div>
      ) : books.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {books.map((book) => (
              <BookCard
                key={book._id}
                id={book._id}
                title={book.title}
                authors={book.authors}
                coverPath={book.coverPath}
                status={book.status}
              />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          <div ref={observerTarget} className="py-8" />

          {/* Loading indicator for next page */}
          {loadingMore && (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[var(--foreground)]/70 mt-2 font-light">
                Loading more books...
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-12 text-center">
          <p className="text-[var(--foreground)]/70 font-light">
            No books found. Try syncing with Calibre or adjusting your filters.
          </p>
        </div>
      )}
    </div>
  );
}
