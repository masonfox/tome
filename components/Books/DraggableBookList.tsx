"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { BookListItem } from "@/components/Books/BookListItem";
import { GripVertical } from "lucide-react";
import { cn } from "@/utils/cn";

interface Book {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  series?: string | null;
  seriesIndex?: number | null;
  rating?: number | null;
  status?: string | null;
  currentProgress?: number;
  sortOrder?: number;
}

interface DraggableBookListProps {
  books: Book[];
  onReorder: (bookIds: number[]) => void;
  renderActions?: (book: Book) => ReactNode;
  isDragEnabled?: boolean;
  isSelectMode?: boolean;
  selectedBookIds?: Set<number>;
  onToggleSelection?: (bookId: number) => void;
}

interface SortableBookItemProps {
  book: Book;
  actions?: ReactNode;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

function SortableBookItem({ book, actions, isSelectMode = false, isSelected = false, onToggleSelection }: SortableBookItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: book.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="flex items-stretch gap-2">
        {/* Drag Handle - Hide in select mode */}
        {!isSelectMode && (
          <button
            {...attributes}
            {...listeners}
            className={cn(
              "flex-shrink-0 px-2 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none",
              "text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors",
              "bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg",
              "hover:bg-[var(--hover-bg)]"
            )}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-5 h-5" />
          </button>
        )}

        {/* Book Item */}
        <div className="flex-1">
          <BookListItem
            book={book}
            actions={actions}
            className={cn(isSortableDragging && "opacity-50")}
            isSelectMode={isSelectMode}
            isSelected={isSelected}
            onToggleSelection={onToggleSelection}
          />
        </div>
      </div>
    </div>
  );
}

export function DraggableBookList({
  books,
  onReorder,
  renderActions,
  isDragEnabled = true,
  isSelectMode = false,
  selectedBookIds = new Set(),
  onToggleSelection,
}: DraggableBookListProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [localBooks, setLocalBooks] = useState(books);
  const isDraggingRef = useRef(false);

  // Disable drag when in select mode
  const effectiveIsDragEnabled = isDragEnabled && !isSelectMode;

  // Update local state when books prop changes (but not during active drag)
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalBooks(books);
    }
  }, [books]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms long-press for mobile
        tolerance: 5, // Allow 5px of movement during long-press
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localBooks.findIndex((book) => book.id === active.id);
      const newIndex = localBooks.findIndex((book) => book.id === over.id);

      const newBooks = arrayMove(localBooks, oldIndex, newIndex);
      setLocalBooks(newBooks);

      // Call parent's reorder handler with new order
      onReorder(newBooks.map((book) => book.id));
    }

    isDraggingRef.current = false;
    setActiveId(null);
  };

  const handleDragCancel = () => {
    isDraggingRef.current = false;
    setActiveId(null);
  };

  const activeBook = localBooks.find((book) => book.id === activeId);

  if (!effectiveIsDragEnabled) {
    // Render without drag-and-drop
    return (
      <div className="space-y-4">
        {books.map((book) => (
          <BookListItem
            key={book.id}
            book={book}
            actions={renderActions?.(book)}
            isSelectMode={isSelectMode}
            isSelected={selectedBookIds.has(book.id)}
            onToggleSelection={() => onToggleSelection?.(book.id)}
          />
        ))}
      </div>
    );
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
        <div className="space-y-4">
          {localBooks.map((book) => (
            <SortableBookItem
              key={book.id}
              book={book}
              actions={renderActions?.(book)}
              isSelectMode={isSelectMode}
              isSelected={selectedBookIds.has(book.id)}
              onToggleSelection={() => onToggleSelection?.(book.id)}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeBook ? (
          <div className="flex items-stretch gap-2 opacity-90">
            {!isSelectMode && (
              <div className="flex-shrink-0 px-2 flex items-center justify-center bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg">
                <GripVertical className="w-5 h-5 text-[var(--foreground)]/40" />
              </div>
            )}
            <div className="flex-1">
              <BookListItem book={activeBook} actions={renderActions?.(activeBook)} />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
