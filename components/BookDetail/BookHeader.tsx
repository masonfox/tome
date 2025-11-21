import Link from "next/link";
import { BookOpen, ChevronDown, Check, Lock, Bookmark, Clock, BookCheck, Star, Pencil } from "lucide-react";
import { cn } from "@/utils/cn";

interface BookHeaderProps {
  book: {
    calibreId: number;
    title: string;
    authors: string[];
    series?: string;
    publisher?: string;
    pubDate?: string;
    totalPages?: number;
    totalReads?: number;
  };
  selectedStatus: string;
  imageError: boolean;
  onImageError: () => void;
  onStatusChange: (status: string) => void;
  onRatingClick: () => void;
  onRereadClick: () => void;
  showStatusDropdown: boolean;
  setShowStatusDropdown: (show: boolean) => void;
  dropdownRef?: React.RefObject<HTMLDivElement>;
  rating: number | null | undefined;
  hasCompletedReads: boolean;
  hasActiveSession: boolean;
}

export default function BookHeader({
  book,
  selectedStatus,
  imageError,
  onImageError,
  onStatusChange,
  onRatingClick,
  onRereadClick,
  showStatusDropdown,
  setShowStatusDropdown,
  dropdownRef,
  rating,
  hasCompletedReads,
  hasActiveSession,
}: BookHeaderProps) {
  const statusOptions = [
    { value: "to-read", label: "Want to Read", disabled: false, icon: Bookmark },
    { value: "read-next", label: "Read Next", disabled: false, icon: Clock },
    { value: "reading", label: "Reading", disabled: !book.totalPages, icon: BookOpen },
    { value: "read", label: "Read", disabled: !book.totalPages, icon: BookCheck },
  ];

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "to-read": return "Want to Read";
      case "read-next": return "Read Next";
      case "reading": return "Reading";
      case "read": return "Read";
      default: return status;
    }
  };

  return (
    <div className="grid md:grid-cols-[250px_1fr] gap-8">
      {/* Left Column - Cover and Status */}
      <div className="space-y-4">
        {/* Cover */}
        <div className="aspect-[2/3] bg-[var(--light-accent)]/30 rounded border border-[var(--border-color)] overflow-hidden flex items-center justify-center">
          {!imageError ? (
            <img
              src={`/api/covers/${book.calibreId}/cover.jpg`}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="eager"
              onError={onImageError}
            />
          ) : (
            <BookOpen className="w-24 h-24 text-[var(--foreground)]/40" />
          )}
        </div>

        {/* Status Dropdown */}
        <div className="space-y-2">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="w-full px-4 py-2.5 bg-[var(--accent)] text-white font-semibold rounded cursor-pointer hover:bg-[var(--light-accent)] transition-colors flex items-center justify-between"
            >
              <span>{getStatusLabel(selectedStatus)}</span>
              <ChevronDown
                className={cn(
                  "w-5 h-5 transition-transform",
                  showStatusDropdown && "rotate-180"
                )}
              />
            </button>

            {/* Dropdown Menu */}
            {showStatusDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden">
                {statusOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        if (!option.disabled) {
                          onStatusChange(option.value);
                          setShowStatusDropdown(false);
                        }
                      }}
                      disabled={option.disabled}
                      className={cn(
                        "w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors group",
                        option.disabled
                          ? "cursor-not-allowed bg-[var(--card-bg)]"
                          : "cursor-pointer hover:bg-[var(--background)]",
                        selectedStatus === option.value && !option.disabled && "bg-[var(--accent)]/10"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {option.disabled ? (
                          <Lock className="w-4 h-4 text-[var(--foreground)]/40" />
                        ) : (
                          <Icon className="w-4 h-4 text-[var(--foreground)]/60" />
                        )}
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              "font-semibold",
                              option.disabled
                                ? "text-[var(--foreground)]/40"
                                : "text-[var(--foreground)]"
                            )}
                          >
                            {option.label}
                          </span>
                          {option.disabled && (
                            <span className="text-xs text-[var(--foreground)]/30 mt-0.5 font-medium">
                              Set pages
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedStatus === option.value && !option.disabled && (
                        <Check className="w-5 h-5 text-[var(--accent)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rating Display */}
          {(rating || selectedStatus === "read") && (
            <div
              className="py-2 group cursor-pointer"
              onClick={onRatingClick}
            >
              <div className="flex justify-center">
                <div className="relative inline-flex gap-1 items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "w-5 h-5 transition-colors",
                        star <= (rating || 0)
                          ? "fill-[var(--accent)] text-[var(--accent)]"
                          : "text-[var(--foreground)]/30"
                      )}
                    />
                  ))}
                  <Pencil className="w-4 h-4 text-[var(--foreground)]/40 opacity-0 group-hover:opacity-100 transition-opacity absolute left-full ml-1.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="text-center mt-3">
                <p className="text-xs text-[var(--subheading-text)] font-medium group-hover:text-[var(--accent)] transition-colors">
                  {rating ? `${rating} ${rating === 1 ? 'star' : 'stars'}` : "Rate this book"}
                </p>
              </div>
            </div>
          )}

          {/* Start Re-reading Button */}
          {!hasActiveSession && hasCompletedReads && (
            <button
              onClick={onRereadClick}
              className="w-full px-4 py-2.5 bg-[var(--background)] text-[var(--foreground)] font-semibold rounded border border-[var(--border-color)] hover:bg-[var(--card-bg)] transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Start Re-reading</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Column - Info */}
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-serif font-bold text-[var(--heading-text)] mb-2">
            {book.title}
          </h1>
          <div className="text-xl text-[var(--subheading-text)] mb-3 font-medium">
            {book.authors.map((author, index) => (
              <span key={author}>
                <Link
                  href={`/library?search=${encodeURIComponent(author)}`}
                  className="hover:text-[var(--accent)] transition-colors hover:underline"
                >
                  {author}
                </Link>
                {index < book.authors.length - 1 && ", "}
              </span>
            ))}
          </div>

          {book.series && (
            <p className="text-sm text-[var(--foreground)]/60 mb-3 italic font-medium">
              {book.series}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
            {(book.totalReads ?? 0) > 0 && (
              <>
                <div className="flex items-center gap-1.5 text-[var(--accent)]">
                  <BookCheck className="w-4 h-4" />
                  <span className="font-semibold">{book.totalReads} {book.totalReads === 1 ? 'read' : 'reads'}</span>
                </div>
                <span className="text-[var(--border-color)]">•</span>
              </>
            )}
            {book.totalPages ? (
              <div className="flex items-center gap-1.5 text-[var(--accent)]">
                <BookOpen className="w-4 h-4" />
                <span className="font-semibold">{book.totalPages.toLocaleString()} pages</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[var(--accent)] italic">
                <BookOpen className="w-4 h-4" />
                <span className="font-medium">Pages not set</span>
              </div>
            )}
            {(book.publisher || book.pubDate) && (
              <>
                <span className="text-[var(--border-color)]">•</span>
                {book.publisher && (
                  <span className="font-medium text-[var(--accent)]">{book.publisher}</span>
                )}
                {book.publisher && book.pubDate && (
                  <span className="text-[var(--foreground)]/30">•</span>
                )}
                {book.pubDate && (
                  <span className="font-medium text-[var(--accent)]">Published {new Date(book.pubDate).getFullYear()}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
