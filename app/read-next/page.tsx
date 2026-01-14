"use client";

/**
 * Read Next Queue Page
 * 
 * Displays and manages the read-next queue with drag-and-drop reordering.
 * Mirrors /shelves/[id] page structure but simplified.
 */

import { useEffect, useState } from "react";
import { useReadNextBooks } from "@/hooks/useReadNextBooks";
import { Clock } from "lucide-react";
import Link from "next/link";

export default function ReadNextPage() {
  const { books, loading, fetchBooks, reorderBooks, updateLocalOrder } = useReadNextBooks();
  const [search, setSearch] = useState("");
  const [isReordering, setIsReordering] = useState(false);

  // Fetch books on mount
  useEffect(() => {
    fetchBooks(search);
  }, []);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBooks(search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);

  // Handle drag-and-drop reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    const dragIndex = parseInt(e.dataTransfer.getData("text/html"));
    if (dragIndex === dropIndex) return;

    // Reorder locally (optimistic update)
    const newBooks = [...books];
    const [movedBook] = newBooks.splice(dragIndex, 1);
    newBooks.splice(dropIndex, 0, movedBook);
    
    updateLocalOrder(newBooks);

    // Prepare updates for API
    const updates = newBooks.map((book, index) => ({
      id: book.id,
      readNextOrder: index,
    }));

    // Send to API
    setIsReordering(true);
    try {
      await reorderBooks(updates);
    } catch (error) {
      // Hook already shows toast, just refresh to revert optimistic update
      await fetchBooks(search);
    } finally {
      setIsReordering(false);
    }
  };

  // Empty state
  if (!loading && books.length === 0 && !search) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Clock className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold">Read Next</h1>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Your read-next queue is empty
          </h2>
          <p className="text-gray-500 mb-6">
            Add books from your library to start building your reading queue
          </p>
          <Link
            href="/library?status=to-read"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Browse Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Clock className="h-8 w-8 text-blue-500" />
        <h1 className="text-3xl font-bold">Read Next</h1>
        <span className="text-gray-500">({books.length})</span>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search books..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Loading state */}
      {loading && books.length === 0 && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Books list */}
      {books.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-4">
            Drag and drop to reorder your queue
          </p>
          
          {books.map((session, index) => (
            <div
              key={session.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={`
                p-4 bg-white border border-gray-200 rounded-lg cursor-move
                hover:border-blue-300 hover:shadow-md transition
                ${isReordering ? "opacity-50" : ""}
              `}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 text-gray-400 font-mono text-sm">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <Link
                    href={`/library/${session.bookId}`}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Book ID: {session.bookId}
                  </Link>
                  <p className="text-sm text-gray-500">
                    Session #{session.sessionNumber} · Order: {session.readNextOrder}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No search results */}
      {!loading && books.length === 0 && search && (
        <div className="text-center py-16">
          <p className="text-gray-500">No books found matching &quot;{search}&quot;</p>
        </div>
      )}
    </div>
  );
}
