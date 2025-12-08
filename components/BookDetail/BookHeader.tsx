import Image from "next/image";
import { BookOpen, ChevronDown, Check, Lock, Bookmark, Clock, BookCheck, Star, Pencil } from "lucide-react";
import { cn } from "@/utils/cn";

interface BookHeaderProps {
  book: {
    calibreId: number;
    totalPages?: number;
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
    { value: "reading", label: "Reading", disabled: false, icon: BookOpen },
    { value: "read", label: "Read", disabled: false, icon: BookCheck },
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

  const StatusDropdownMenu = () => (
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
  );

  return (
    <div className="w-full max-w-[220px] md:max-w-none md:w-[250px] mx-auto md:mx-0 space-y-4">
      {/* Cover */}
      <div className="relative aspect-[2/3] bg-[var(--light-accent)]/30 rounded border border-[var(--border-color)] overflow-hidden flex items-center justify-center shadow-lg">
        {!imageError ? (
          <Image
            src={`/api/covers/${book.calibreId}/cover.jpg`}
            alt="Book cover"
            fill
            sizes="(max-width: 768px) 220px, 250px"
            className="object-cover"
            onError={onImageError}
          />
        ) : (
          <BookOpen className="w-16 md:w-24 h-16 md:h-24 text-[var(--foreground)]/40" />
        )}
      </div>

      {/* Status dropdown */}
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

        {showStatusDropdown && <StatusDropdownMenu />}
      </div>

      {/* Rating Display */}
      {(rating || selectedStatus === "read") && (
        <div
          className="py-2 group cursor-pointer"
          onClick={onRatingClick}
        >
          <div className="flex justify-center items-center gap-2">
            <div className="flex gap-1 items-center">
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
            </div>
            <Pencil className="w-4 h-4 text-[var(--subheading-text)]" />
          </div>
          <div className="text-center mt-3">
            <p className="text-xs text-[var(--subheading-text)] font-medium group-hover:text-[var(--accent)] transition-colors">
              {rating ? `${rating} ${rating === 1 ? 'star' : 'stars'}` : "Rate this book"}
            </p>
          </div>
        </div>
      )}

      {/* Re-read Button */}
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
  );
}
