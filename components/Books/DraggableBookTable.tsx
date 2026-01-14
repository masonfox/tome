"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, Star, ArrowUpDown, ArrowUp, ArrowDown, Trash2, ExternalLink, GripVertical } from "lucide-react";
import { cn } from "@/utils/cn";
import { format } from "date-fns";
import { StatusBadge } from "@/components/Utilities/StatusBadge";
import { type BookStatus } from "@/utils/statusConfig";
import { getCoverUrl } from "@/lib/utils/cover-url";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortDirection = "asc" | "desc";

interface BookTableBook {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  series?: string | null;
  seriesIndex?: number | null;
  rating?: number | null;
  totalPages?: number | null;
  addedToLibrary?: Date | null;
  dateAddedToShelf?: Date | null;
  status?: string | null;
  sortOrder?: number;
  lastSynced?: Date | string | null;
}

interface DraggableBookTableProps {
  books: BookTableBook[];
  sortBy?: string;
  sortDirection?: SortDirection;
  onSortChange?: (column: string, direction: SortDirection) => void;
  onRemoveBook?: (bookId: number) => void;
  onReorder?: (bookIds: number[]) => void;
  loading?: boolean;
  className?: string;
  isDragEnabled?: boolean;
  isSelectMode?: boolean;
  selectedBookIds?: Set<number>;
  onToggleSelection?: (bookId: number) => void;
  onToggleSelectAll?: () => void;
}

interface SortableRowProps {
  book: BookTableBook;
  index: number;
  imageErrors: Set<number>;
  onImageError: (calibreId: number) => void;
  onRemoveBook?: (bookId: number) => void;
  isDragEnabled: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

function SortableRow({ book, index, imageErrors, onImageError, onRemoveBook, isDragEnabled, isSelectMode = false, isSelected = false, onToggleSelection }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: book.id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasImageError = imageErrors.has(book.calibreId);
  const seriesInfo = book.series && book.seriesIndex
    ? `${book.series} #${book.seriesIndex}`
    : book.series || "-";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-colors",
        isSelectMode && "cursor-pointer",
        isSelectMode && isSelected && "bg-[var(--accent)]/10",
        !isSelectMode && "hover:bg-[var(--hover-bg)]",
        index % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--background)]",
        isDragging && "relative z-50"
      )}
      onClick={isSelectMode ? onToggleSelection : undefined}
    >
      {/* Checkbox Column - Show in select mode */}
      {isSelectMode && (
        <td className="px-4 py-3">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelection?.()}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-[var(--border-color)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>
        </td>
      )}

      {/* Drag Handle - Hide in select mode */}
      {isDragEnabled && !isSelectMode && (
        <td className="px-2 py-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-2 hover:bg-[var(--hover-bg)] rounded transition-colors touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-5 h-5 text-[var(--foreground)]/40" />
          </button>
        </td>
      )}

      {/* Cover */}
      <td className="px-4 py-3">
        <Link href={`/books/${book.id}`} className="block">
          <div className="w-10 h-[60px] bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden rounded relative">
            {!hasImageError ? (
              <Image
                src={getCoverUrl(book.calibreId, book.lastSynced)}
                alt={book.title}
                fill
                loading="lazy"
                className="object-cover"
                onError={() => onImageError(book.calibreId)}
              />
            ) : (
              <BookOpen className="w-5 h-5 text-[var(--accent)]/40" />
            )}
          </div>
        </Link>
      </td>

      {/* Order */}
      <td className="px-4 py-3 text-[var(--foreground)]/80 text-sm text-center">
        {book.sortOrder !== undefined ? book.sortOrder + 1 : "-"}
      </td>

      {/* Title */}
      <td className="px-4 py-3">
        <Link
          href={`/books/${book.id}`}
          className="font-medium text-[var(--heading-text)] hover:text-[var(--accent)] transition-colors line-clamp-2"
        >
          {book.title}
        </Link>
      </td>

      {/* Author */}
      <td className="px-4 py-3 text-sm">
        {book.authors.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {book.authors.map((author, idx) => (
              <span key={author}>
                <Link
                  href={`/library?search=${encodeURIComponent(author)}`}
                  className="text-[var(--foreground)]/80 hover:text-[var(--accent)] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {author}
                </Link>
                {idx < book.authors.length - 1 && (
                  <span className="text-[var(--foreground)]/80">, </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[var(--foreground)]/40">-</span>
        )}
      </td>

      {/* Series */}
      <td className="px-4 py-3 text-sm">
        {book.series ? (
          <Link
            href={`/series/${encodeURIComponent(book.series)}`}
            className="text-[var(--foreground)]/80 hover:text-[var(--accent)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {seriesInfo}
          </Link>
        ) : (
          <span className="text-[var(--foreground)]/40">-</span>
        )}
      </td>

      {/* Rating */}
      <td className="px-4 py-3">
        {book.rating && book.rating > 0 ? (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-4 h-4",
                  i < book.rating!
                    ? "fill-amber-400 text-amber-400"
                    : "text-[var(--foreground)]/20"
                )}
              />
            ))}
          </div>
        ) : (
          <span className="text-[var(--foreground)]/40 text-sm">-</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {book.status ? (
          <StatusBadge status={book.status as BookStatus} size="sm" />
        ) : (
          <span className="text-[var(--foreground)]/40 text-sm">-</span>
        )}
      </td>

      {/* Pages */}
      <td className="px-4 py-3 text-[var(--foreground)]/80 text-sm text-center">
        {book.totalPages || "-"}
      </td>

      {/* Date Added */}
      <td className="px-4 py-3 text-[var(--foreground)]/80 text-sm">
        {book.dateAddedToShelf
          ? format(new Date(book.dateAddedToShelf), "MMM dd, yyyy")
          : book.addedToLibrary
          ? format(new Date(book.addedToLibrary), "MMM dd, yyyy")
          : "-"}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/books/${book.id}`}
            className="p-1.5 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors"
            title="View details"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          {onRemoveBook && !isSelectMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveBook(book.id);
              }}
              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
              title="Remove from shelf"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function DraggableBookTable({
  books,
  sortBy,
  sortDirection,
  onSortChange,
  onRemoveBook,
  onReorder,
  loading = false,
  className,
  isDragEnabled = false,
  isSelectMode = false,
  selectedBookIds = new Set(),
  onToggleSelection,
  onToggleSelectAll,
}: DraggableBookTableProps) {
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [localBooks, setLocalBooks] = useState(books);

  // Disable drag when in select mode
  const effectiveIsDragEnabled = isDragEnabled && !isSelectMode;

  // Update local state when books prop changes
  if (books !== localBooks) {
    setLocalBooks(books);
  }

  // Check if all visible books are selected
  const allSelected = books.length > 0 && books.every((book) => selectedBookIds.has(book.id));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleImageError = (calibreId: number) => {
    setImageErrors((prev) => new Set(prev).add(calibreId));
  };

  const handleColumnClick = (column: string) => {
    if (!onSortChange) return;
    
    if (sortBy === column) {
      const newDirection = sortDirection === "asc" ? "desc" : "asc";
      onSortChange(column, newDirection);
    } else {
      onSortChange(column, "asc");
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  const SortableHeader = ({
    column,
    children,
    className: headerClassName,
  }: {
    column: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={cn(
        "px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] cursor-pointer hover:bg-[var(--hover-bg)] transition-colors select-none",
        headerClassName
      )}
      onClick={() => handleColumnClick(column)}
    >
      <div className="flex items-center gap-2">
        {children}
        {renderSortIcon(column)}
      </div>
    </th>
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localBooks.findIndex((book) => book.id === active.id);
      const newIndex = localBooks.findIndex((book) => book.id === over.id);

      const newBooks = arrayMove(localBooks, oldIndex, newIndex);
      setLocalBooks(newBooks);

      if (onReorder) {
        onReorder(newBooks.map((book) => book.id));
      }
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  if (loading) {
    return <BookTableSkeleton isDragEnabled={effectiveIsDragEnabled} isSelectMode={isSelectMode} />;
  }

  if (books.length === 0) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-12 text-center">
        <BookOpen className="w-16 h-16 text-[var(--accent)]/40 mx-auto mb-4" />
        <h3 className="text-xl font-serif font-semibold text-[var(--heading-text)] mb-2">
          No books on this shelf
        </h3>
        <p className="text-[var(--foreground)]/70 mb-6">
          Add books to this shelf from your library
        </p>
        <Link
          href="/library"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors font-medium"
        >
          Go to Library
        </Link>
      </div>
    );
  }

  const content = (
    <div className={cn("overflow-x-auto rounded-lg border border-[var(--border-color)]", className)}>
      <table className="w-full bg-[var(--card-bg)]">
        <thead className="bg-[var(--background)] border-b border-[var(--border-color)] sticky top-0 z-10">
          <tr>
            {/* Checkbox Column Header - Show in select mode */}
            {isSelectMode && (
              <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] w-[60px]">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded border-[var(--border-color)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                    aria-label="Select all books"
                  />
                </div>
              </th>
            )}
            {effectiveIsDragEnabled && (
              <th className="px-2 py-3 text-left text-sm font-semibold text-[var(--heading-text)] w-[60px]">
                {/* Drag handle column */}
              </th>
            )}
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] w-[60px]">
              Cover
            </th>
            <SortableHeader column="sortOrder" className="w-[80px]">
              Order
            </SortableHeader>
            <SortableHeader column="title" className="min-w-[200px]">
              Title
            </SortableHeader>
            <SortableHeader column="author" className="min-w-[150px]">
              Author
            </SortableHeader>
            <SortableHeader column="series" className="min-w-[150px]">
              Series
            </SortableHeader>
            <SortableHeader column="rating" className="w-[120px]">
              Rating
            </SortableHeader>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] w-[120px]">
              Status
            </th>
            <SortableHeader column="pages" className="w-[100px]">
              Pages
            </SortableHeader>
            <SortableHeader column="dateAdded" className="w-[140px]">
              Date Added
            </SortableHeader>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--heading-text)] w-[100px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {localBooks.map((book, index) => (
            <SortableRow
              key={book.id}
              book={book}
              index={index}
              imageErrors={imageErrors}
              onImageError={handleImageError}
              onRemoveBook={onRemoveBook}
              isDragEnabled={effectiveIsDragEnabled}
              isSelectMode={isSelectMode}
              isSelected={selectedBookIds.has(book.id)}
              onToggleSelection={() => onToggleSelection?.(book.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!effectiveIsDragEnabled) {
    return content;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={localBooks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {content}
      </SortableContext>

      <DragOverlay>
        {activeId ? (
          <div className="bg-[var(--card-bg)] border-2 border-[var(--accent)] rounded-lg shadow-2xl opacity-90">
            <table className="w-full">
              <tbody>
                {localBooks
                  .filter((book) => book.id === activeId)
                  .map((book, index) => (
                    <SortableRow
                      key={book.id}
                      book={book}
                      index={index}
                      imageErrors={imageErrors}
                      onImageError={handleImageError}
                      isDragEnabled={false}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BookTableSkeleton({ isDragEnabled = false, isSelectMode = false }: { isDragEnabled?: boolean; isSelectMode?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
      <table className="w-full bg-[var(--card-bg)]">
        <thead className="bg-[var(--background)] border-b border-[var(--border-color)]">
          <tr>
            {isSelectMode && (
              <th className="px-4 py-3 w-[60px]">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-8 mx-auto" />
              </th>
            )}
            {isDragEnabled && (
              <th className="px-2 py-3 w-[60px]">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-8" />
              </th>
            )}
            <th className="px-4 py-3 w-[60px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            <th className="px-4 py-3 w-[80px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            <th className="px-4 py-3 min-w-[200px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-16" />
            </th>
            <th className="px-4 py-3 min-w-[150px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-16" />
            </th>
            <th className="px-4 py-3 min-w-[150px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-16" />
            </th>
            <th className="px-4 py-3 w-[120px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            <th className="px-4 py-3 w-[120px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            <th className="px-4 py-3 w-[100px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
            <th className="px-4 py-3 w-[140px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-20" />
            </th>
            <th className="px-4 py-3 w-[100px]">
              <div className="h-4 bg-[var(--hover-bg)] rounded w-12" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <tr
              key={index}
              className={cn(
                "animate-pulse",
                index % 2 === 0 ? "bg-[var(--card-bg)]" : "bg-[var(--background)]"
              )}
            >
              {isSelectMode && (
                <td className="px-4 py-3">
                  <div className="h-5 bg-[var(--hover-bg)] rounded w-5 mx-auto" />
                </td>
              )}
              {isDragEnabled && (
                <td className="px-2 py-3">
                  <div className="h-8 bg-[var(--hover-bg)] rounded w-8" />
                </td>
              )}
              <td className="px-4 py-3">
                <div className="w-10 h-[60px] bg-[var(--hover-bg)] rounded" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-8 mx-auto" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-3/4" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-2/3" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-1/2" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-20" />
              </td>
              <td className="px-4 py-3">
                <div className="h-6 bg-[var(--hover-bg)] rounded w-16" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-12 mx-auto" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 bg-[var(--hover-bg)] rounded w-24" />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-[var(--hover-bg)] rounded" />
                  <div className="w-8 h-8 bg-[var(--hover-bg)] rounded" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
