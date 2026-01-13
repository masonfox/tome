import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronDown, Check, Lock, Pencil, Star } from "lucide-react";
import { cn } from "@/utils/cn";
import { STATUS_CONFIG, type BookStatus } from "@/utils/statusConfig";

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
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  rating: number | null | undefined;
  hasCompletedReads: boolean;
  hasFinishedSessions: boolean;
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
  hasFinishedSessions,
  hasActiveSession,
}: BookHeaderProps) {
  // Status options with conditional disabling based on current status
  const statusOptions = [
    { value: "to-read" as const, disabled: false },
    { value: "read-next" as const, disabled: false },
    { value: "reading" as const, disabled: false },
    { value: "read" as const, disabled: selectedStatus === "dnf" }, // Can't go from DNF to Read
    { value: "dnf" as const, disabled: selectedStatus !== "reading" }, // Can only DNF from Reading
  ];

  // Get the current status configuration for button styling
  const currentStatusConfig = STATUS_CONFIG[selectedStatus as BookStatus];

  const StatusDropdownMenu = () => (
    <div className="absolute z-10 w-full mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-lg overflow-hidden">
      {statusOptions.map((option) => {
        const optionConfig = STATUS_CONFIG[option.value as BookStatus];
        const Icon = optionConfig.icon;
        const isSelected = selectedStatus === option.value;
        
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
            title={option.disabled && option.value === "dnf" 
              ? "Only available when actively reading" 
              : undefined}
            className={cn(
              "w-full px-4 py-3 text-left flex items-center justify-between transition-all group",
              option.disabled
                ? "cursor-not-allowed opacity-55"
                : "cursor-pointer hover:bg-[var(--background)]",
              isSelected && !option.disabled && "bg-[var(--background)]"
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              {option.disabled ? (
                <>
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-md shadow-sm bg-[var(--background)]">
                    <Lock className="w-4 h-4 text-red-500/80" />
                  </div>
                  <span className="font-semibold text-[var(--foreground)]/55">
                    {optionConfig.labels.long}
                  </span>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      "inline-flex items-center justify-center w-8 h-8 rounded-md shadow-sm transition-all",
                      "bg-gradient-to-r",
                      optionConfig.lightGradient
                    )}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-[var(--foreground)]">
                    {optionConfig.labels.long}
                  </span>
                </>
              )}
            </div>
            {isSelected && !option.disabled && (
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
              src={`/api/books/${book.calibreId}/cover`}
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
          className={cn(
            "w-full px-4 py-3 font-semibold rounded-md cursor-pointer transition-all flex items-center justify-between shadow-sm hover:shadow-md",
            "bg-gradient-to-r text-white",
            currentStatusConfig?.lightGradient || "bg-[var(--accent)]"
          )}
        >
          <div className="flex items-center gap-2">
            {currentStatusConfig && (
              <currentStatusConfig.icon className="w-4 h-4" />
            )}
            <span>{currentStatusConfig?.labels.long || selectedStatus}</span>
          </div>
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
      {(selectedStatus === "read" || selectedStatus === "dnf") && (
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
