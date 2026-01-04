"use client";

import { ChevronDown, Check, TrendingUp } from "lucide-react";
import { cn } from "@/utils/cn";
import { getTodayLocalDate } from '@/utils/dateHelpers';
import MarkdownEditor from "@/components/MarkdownEditor";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { useRef, useEffect } from "react";

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
  onEditorReady?: (methods: MDXEditorMethods) => void;
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
  onEditorReady,
  showProgressModeDropdown,
  setShowProgressModeDropdown,
  progressModeDropdownRef,
}: BookProgressProps) {
  const progressPercentage = book.latestProgress?.currentPercentage || 0;
  const editorRef = useRef<MDXEditorMethods>(null);

  // Notify parent when editor ref is ready
  useEffect(() => {
    if (editorRef.current && onEditorReady) {
      onEditorReady(editorRef.current);
    }
  }, [onEditorReady]);

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-[var(--heading-text)] mb-6">
        Log Progress
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
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
                      className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent"
                      placeholder="Current page"
                    />
                  ) : (
                    <input
                      type="number"
                      value={currentPercentage}
                      onChange={(e) => onCurrentPercentageChange(e.target.value)}
                      min="0"
                      max="100"
                      step="1"
                      className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent"
                      placeholder="Percentage"
                    />
                  )}

                  {/* Mode Toggle Dropdown */}
                  <div className="relative" ref={progressModeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowProgressModeDropdown(!showProgressModeDropdown)}
                      className="w-24 md:w-32 px-3 md:px-4 py-2 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors font-semibold flex items-center justify-between"
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
                  max={getTodayLocalDate()}
                  className="w-full px-4 py-3 border border-[var(--border-color)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:outline focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2 focus:border-transparent max-h-[42px] text-left"
                />
              </div>
            </div>

              <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--foreground)]/60 mb-2 font-semibold">
                Notes
              </label>
              <div>
                <MarkdownEditor
                  ref={editorRef}
                  value={notes}
                  onChange={onNotesChange}
                  placeholder="Add notes about your reading session..."
                  height={280}
                />
              </div>
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
  );
}
