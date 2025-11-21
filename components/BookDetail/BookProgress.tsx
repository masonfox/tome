import { ChevronDown, Check, TrendingUp } from "lucide-react";
import { cn } from "@/utils/cn";

interface BookProgressProps {
  book: {
    totalPages?: number;
    latestProgress?: {
      currentPage: number;
      currentPercentage: number;
    };
  };
  currentPage: string;
  currentPercentage: string;
  progressInputMode: "page" | "percentage";
  notes: string;
  progressDate: string;
  onCurrentPageChange: (value: string) => void;
  onCurrentPercentageChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onProgressDateChange: (value: string) => void;
  onProgressInputModeChange: (mode: "page" | "percentage") => void;
  onSubmit: (e: React.FormEvent) => void;
  showProgressModeDropdown: boolean;
  setShowProgressModeDropdown: (show: boolean) => void;
  progressModeDropdownRef?: React.RefObject<HTMLDivElement>;
}

export default function BookProgress({
  book,
  currentPage,
  currentPercentage,
  progressInputMode,
  notes,
  progressDate,
  onCurrentPageChange,
  onCurrentPercentageChange,
  onNotesChange,
  onProgressDateChange,
  onProgressInputModeChange,
  onSubmit,
  showProgressModeDropdown,
  setShowProgressModeDropdown,
  progressModeDropdownRef,
}: BookProgressProps) {
  const progressPercentage = book.latestProgress?.currentPercentage || 0;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      {book.totalPages && (
        <div>
          <div className="flex items-center justify-between text-sm text-[var(--foreground)]/70 mb-2">
            <span className="font-bold">Progress</span>
          </div>
          <div className="relative w-full bg-[var(--border-color)] rounded-md h-8 overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)] transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, progressPercentage)}%` }}
            />
            <div className="absolute inset-0 flex items-center px-3 top-1">
              <span className="text-sm font-mono font-bold text-white drop-shadow-sm">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>
          <p className="text-sm text-[var(--foreground)]/30 mt-3 font-mono font-medium">
            Page {book.latestProgress?.currentPage || 0} of {book.totalPages}
          </p>
        </div>
      )}

      {/* Progress Logging Form */}
      {book.totalPages && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-6">
          <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
            Log Progress
          </h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 mb-2 font-semibold">
                  Progress
                </label>
                <div className="flex gap-2">
                  {progressInputMode === "page" ? (
                    <input
                      type="number"
                      value={currentPage}
                      onChange={(e) => onCurrentPageChange(e.target.value)}
                      min="0"
                      max={book.totalPages}
                      step="1"
                      className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                      placeholder="Enter current page"
                    />
                  ) : (
                    <input
                      type="number"
                      value={currentPercentage}
                      onChange={(e) => onCurrentPercentageChange(e.target.value)}
                      min="0"
                      max="100"
                      step="0.01"
                      className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                      placeholder="Enter percentage"
                    />
                  )}

                  {/* Mode Toggle Dropdown */}
                  <div className="relative" ref={progressModeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowProgressModeDropdown(!showProgressModeDropdown)}
                      className="w-32 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors font-semibold flex items-center justify-between"
                    >
                      <span>{progressInputMode === "page" ? "Page" : "%"}</span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform",
                          showProgressModeDropdown && "rotate-180"
                        )}
                      />
                    </button>

                    {showProgressModeDropdown && (
                      <div className="absolute z-10 right-0 mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            onProgressInputModeChange("page");
                            setShowProgressModeDropdown(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors",
                            progressInputMode === "page"
                              ? "bg-[var(--accent)]/10"
                              : "hover:bg-[var(--background)]"
                          )}
                        >
                          <span className="font-semibold text-[var(--foreground)]">Page</span>
                          {progressInputMode === "page" && (
                            <Check className="w-4 h-4 text-[var(--accent)]" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onProgressInputModeChange("percentage");
                            setShowProgressModeDropdown(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors",
                            progressInputMode === "percentage"
                              ? "bg-[var(--accent)]/10"
                              : "hover:bg-[var(--background)]"
                          )}
                        >
                          <span className="font-semibold text-[var(--foreground)]">Percentage</span>
                          {progressInputMode === "percentage" && (
                            <Check className="w-4 h-4 text-[var(--accent)]" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 mb-2 font-semibold">
                  Date
                </label>
                <input
                  type="date"
                  value={progressDate}
                  onChange={(e) => onProgressDateChange(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 mb-2 font-semibold">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none"
                placeholder="Add notes about your reading session (optional)"
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-semibold hover:bg-[var(--light-accent)] transition-colors flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              Log Progress
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
