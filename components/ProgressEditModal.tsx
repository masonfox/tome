"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Check, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import BaseModal from "./BaseModal";
import { parseISO, startOfDay } from "date-fns";

interface ProgressEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    currentPage?: number;
    currentPercentage?: number;
    notes?: string;
    progressDate?: string;
  }) => void;
  onDelete: () => void;
  bookTitle: string;
  totalPages?: number;
  currentProgress: {
    id: number;
    currentPage: number;
    currentPercentage: number;
    progressDate: string;
    notes?: string;
  };
}

export default function ProgressEditModal({
  isOpen,
  onClose,
  onConfirm,
  onDelete,
  bookTitle,
  totalPages,
  currentProgress,
}: ProgressEditModalProps) {
  const [progressInputMode, setProgressInputMode] = useState<"page" | "percentage">("page");
  const [currentPage, setCurrentPage] = useState("");
  const [currentPercentage, setCurrentPercentage] = useState("");
  const [notes, setNotes] = useState("");
  const [progressDate, setProgressDate] = useState("");
  const [showProgressModeDropdown, setShowProgressModeDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when modal opens with current values
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(currentProgress.currentPage.toString());
      setCurrentPercentage(currentProgress.currentPercentage.toString());
      setNotes(currentProgress.notes || "");
      setProgressDate(currentProgress.progressDate.split("T")[0]);
      setShowDeleteConfirm(false);
      
      // Load saved progress input mode preference
      if (typeof window !== "undefined") {
        const savedMode = localStorage.getItem("progressInputMode");
        if (savedMode === "page" || savedMode === "percentage") {
          setProgressInputMode(savedMode);
        }
      }
    }
  }, [isOpen, currentProgress]);

  function handleSave() {
    const data: any = {};

    if (progressInputMode === "page") {
      const pageValue = parseInt(currentPage);
      if (!isNaN(pageValue)) {
        data.currentPage = pageValue;
      }
    } else {
      const percentValue = parseFloat(currentPercentage);
      if (!isNaN(percentValue)) {
        data.currentPercentage = percentValue;
      }
    }

    data.notes = notes.trim() || undefined;
    
    // Parse the selected date and get midnight in LOCAL timezone
    // This ensures the timestamp represents the intended calendar day in the user's timezone
    const localMidnight = startOfDay(parseISO(progressDate));
    
    // Send as ISO string (will be stored as UTC but represents local midnight)
    data.progressDate = localMidnight.toISOString();

    onConfirm(data);
  }

  function handleDeleteClick() {
    setShowDeleteConfirm(true);
  }

  function handleConfirmDelete() {
    onDelete();
    setShowDeleteConfirm(false);
  }

  function handleCancelDelete() {
    setShowDeleteConfirm(false);
  }

  if (showDeleteConfirm) {
    return (
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Delete Progress Entry?"
        actions={
          <div className="flex justify-end gap-4">
            <button
              onClick={handleCancelDelete}
              className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] font-semibold rounded hover:bg-[var(--background)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-4 py-2 bg-red-500 text-white font-semibold rounded hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[var(--foreground)]/80 font-medium">
            Are you sure you want to delete this progress entry? This action cannot be undone.
          </p>
          <div className="bg-[var(--background)] border border-[var(--border-color)] rounded p-4">
            <p className="text-sm text-[var(--foreground)]/70 font-medium">
              <span className="font-semibold">Date:</span>{" "}
              {new Date(currentProgress.progressDate).toLocaleDateString()}
            </p>
            <p className="text-sm text-[var(--foreground)]/70 font-medium mt-1">
              <span className="font-semibold">Progress:</span>{" "}
              {progressInputMode === "page"
                ? `Page ${currentProgress.currentPage}`
                : `${Math.round(currentProgress.currentPercentage)}%`}
            </p>
            {currentProgress.notes && (
              <p className="text-sm text-[var(--foreground)]/70 font-medium mt-1">
                <span className="font-semibold">Notes:</span> {currentProgress.notes}
              </p>
            )}
          </div>
        </div>
      </BaseModal>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Progress - ${bookTitle}`}
      actions={
        <div className="flex justify-between w-full">
          <button
            onClick={handleDeleteClick}
            className="px-4 py-2 bg-red-500 text-white font-semibold rounded hover:bg-red-600 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--foreground)] font-semibold rounded hover:bg-[var(--background)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[var(--accent)] text-white font-semibold rounded hover:bg-[var(--light-accent)] transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Date Field */}
        <div>
          <label
            htmlFor="progressDate"
            className="block text-sm font-semibold text-[var(--foreground)]/80 mb-2"
          >
            Date
          </label>
          <input
            id="progressDate"
            type="date"
            value={progressDate}
            onChange={(e) => setProgressDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] max-h-[42px]"
            style={{ textAlign: 'left' }}
          />
        </div>

        {/* Progress Input with Toggle */}
        <div>
          <label className="block text-sm font-semibold text-[var(--foreground)]/80 mb-2">
            Progress
          </label>
          <div className="flex gap-2">
            {progressInputMode === "page" ? (
              <input
                type="number"
                value={currentPage}
                onChange={(e) => setCurrentPage(e.target.value)}
                min="0"
                max={totalPages}
                step="1"
                className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="Enter current page"
              />
            ) : (
              <input
                type="number"
                value={currentPercentage}
                onChange={(e) => setCurrentPercentage(e.target.value)}
                min="0"
                max="100"
                step="1"
                className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--foreground)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="Enter percentage"
              />
            )}

            {/* Progress Mode Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProgressModeDropdown(!showProgressModeDropdown)}
                className="w-32 px-4 py-2 border border-[var(--border-color)] rounded bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors font-semibold flex items-center justify-between"
              >
                <span>{progressInputMode === "page" ? "Page" : "%"}</span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform",
                    showProgressModeDropdown && "rotate-180"
                  )}
                />
              </button>

              {/* Dropdown Menu */}
              {showProgressModeDropdown && (
                <div className="absolute z-10 right-0 mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setProgressInputMode("page");
                      localStorage.setItem("progressInputMode", "page");
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
                      setProgressInputMode("percentage");
                      localStorage.setItem("progressInputMode", "percentage");
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

        {/* Notes Field */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-semibold text-[var(--foreground)]/80 mb-2"
          >
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this reading session..."
            rows={4}
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border-color)] rounded text-[var(--foreground)] font-medium placeholder:text-[var(--foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          />
        </div>
      </div>
    </BaseModal>
  );
}
