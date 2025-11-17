"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { BookCard } from "@/components/BookCard";
import { Search, Filter, RefreshCw } from "lucide-react";
import { cn } from "@/utils/cn";

interface Book {
  _id: string;
  title: string;
  authors: string[];
  coverPath?: string;
  status: string | null;
}

const BOOKS_PER_PAGE = 50;

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalBooks, setTotalBooks] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBooks([]);
    setCurrentPage(0);
    setHasMore(true);
    fetchBooks(0);
  }, [statusFilter, search]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Library
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {totalBooks} {totalBooks === 1 ? "book" : "books"}
          </p>
        </div>

        <button
          onClick={syncCalibre}
          disabled={syncing}
          className={cn(
            "flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors",
            syncing && "opacity-50 cursor-not-allowed"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync Calibre"}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search books..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Books</option>
              <option value="to-read">To Read</option>
              <option value="reading">Reading</option>
              <option value="read">Read</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Books Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-4">
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
              <div className="inline-block w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Loading more books...
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No books found. Try syncing with Calibre or adjusting your filters.
          </p>
        </div>
      )}
    </div>
  );
}
