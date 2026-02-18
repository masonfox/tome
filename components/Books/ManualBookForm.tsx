"use client";

import { useState, useEffect, useRef } from "react";
import BaseModal from "@/components/Modals/BaseModal";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import { Button } from "@/components/Utilities/Button";
import { toast } from "@/utils/toast";
import { getLogger } from "@/lib/logger";
import { BookPlus } from "lucide-react";
import type { ManualBookInput } from "@/lib/validation/manual-book.schema";
import type { PotentialDuplicate } from "@/lib/services/duplicate-detection.service";
import CoverUploadField from "./CoverUploadField";

const logger = getLogger().child({ component: "ManualBookForm" });

interface ManualBookFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookId: number) => void;
}

interface ValidationError {
  path: (string | number)[];
  message: string;
}

export default function ManualBookForm({
  isOpen,
  onClose,
  onSuccess,
}: ManualBookFormProps) {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [series, setSeries] = useState("");
  const [seriesIndex, setSeriesIndex] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  // Cover upload state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setAuthors("");
      setIsbn("");
      setPublisher("");
      setPubDate("");
      setTotalPages("");
      setSeries("");
      setSeriesIndex("");
      setDescription("");
      setTags("");
      setCoverFile(null);
      setCoverUrl("");
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
        setCoverPreviewUrl(null);
      }
      setValidationErrors({});
      setDuplicates([]);
      setShowDuplicateWarning(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time validation on blur (title and authors only)
  const validateField = async (field: "title" | "authors") => {
    if (field === "title" && !title.trim()) {
      setValidationErrors((prev) => ({ ...prev, title: "Title is required" }));
      return;
    }
    
    if (field === "authors" && !authors.trim()) {
      setValidationErrors((prev) => ({ ...prev, authors: "At least one author is required" }));
      return;
    }

    // Clear error if field is valid
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });

    // Check for duplicates if both title and authors are filled
    if (title.trim() && authors.trim()) {
      try {
        const response = await fetch("/api/books/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            authors: authors.split(",").map((a) => a.trim()).filter((a) => a),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.duplicates?.hasDuplicates) {
            setDuplicates(data.duplicates.duplicates);
          } else {
            setDuplicates([]);
          }
        }
      } catch (error) {
        logger.error({ error }, "Failed to check for duplicates");
      }
    }
  };

  const handleSubmit = async () => {
    // Clear previous errors
    setValidationErrors({});

    // Parse authors
    const authorList = authors
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a);

    if (!title.trim()) {
      setValidationErrors({ title: "Title is required" });
      return;
    }

    if (authorList.length === 0) {
      setValidationErrors({ authors: "At least one author is required" });
      return;
    }

    // Show duplicate warning if duplicates exist and not already shown
    if (duplicates.length > 0 && !showDuplicateWarning) {
      setShowDuplicateWarning(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare payload
      const payload: Partial<ManualBookInput> = {
        title: title.trim(),
        authors: authorList,
      };

      // Add optional fields
      if (isbn.trim()) payload.isbn = isbn.trim();
      if (publisher.trim()) payload.publisher = publisher.trim();
      if (pubDate.trim()) payload.pubDate = new Date(pubDate);
      if (totalPages.trim()) payload.totalPages = parseInt(totalPages, 10);
      if (series.trim()) payload.series = series.trim();
      if (seriesIndex.trim()) payload.seriesIndex = parseFloat(seriesIndex);
      if (description.trim()) payload.description = description.trim();
      if (tags.trim()) {
        payload.tags = tags.split(",").map((t) => t.trim()).filter((t) => t);
      }

      // Submit to API
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        
        if (error.details) {
          // Zod validation errors
          const errors: Record<string, string> = {};
          error.details.forEach((err: ValidationError) => {
            const field = err.path[0] as string;
            errors[field] = err.message;
          });
          setValidationErrors(errors);
        } else {
          toast.error(error.error || "Failed to create book");
        }
        return;
      }

      const result = await response.json();
      logger.info({ bookId: result.book.id }, "Manual book created successfully");

      // Upload cover image if one was selected (TC13)
      // Send either file or URL to server (server will download URL)
      if (coverFile || coverUrl.trim()) {
        try {
          const formData = new FormData();
          
          if (coverFile) {
            formData.append("cover", coverFile);
          } else if (coverUrl.trim()) {
            formData.append("coverUrl", coverUrl.trim());
          }

          const coverResponse = await fetch(`/api/books/${result.book.id}/cover`, {
            method: "POST",
            body: formData,
          });

          if (!coverResponse.ok) {
            const coverError = await coverResponse.json();
            logger.warn(
              { bookId: result.book.id, error: coverError },
              "Cover upload failed, but book was created successfully"
            );
            // Non-blocking: book is created, just warn about cover
            toast.warning(`Book added, but cover upload failed: ${coverError.error || "Unknown error"}`);
          } else {
            logger.info({ bookId: result.book.id }, "Cover uploaded successfully");
          }
        } catch (coverError) {
          logger.error({ error: coverError }, "Cover upload request failed");
          // Non-blocking: book created successfully
        }
      }
      
      toast.success(`"${result.book.title}" added to your library`);
      onSuccess(result.book.id);
      onClose();
    } catch (error) {
      logger.error({ error }, "Failed to create manual book");
      toast.error("Failed to create book. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (showDuplicateWarning) {
      setShowDuplicateWarning(false);
    } else {
      onClose();
    }
  };

  // Determine modal title and subtitle
  const modalTitle = showDuplicateWarning ? "Potential Duplicates Found" : "Add Manual Book";
  const modalSubtitle = showDuplicateWarning
    ? "We found books that might be duplicates. Proceed anyway?"
    : "Add a book that's not in your Calibre library";
  const modalIcon = <BookPlus className="w-5 h-5" />;

  // Modal content
  const modalContent = showDuplicateWarning ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--subheading-text)]">
            The following {duplicates.length === 1 ? "book" : "books"} in your library {duplicates.length === 1 ? "appears" : "appear"} similar:
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {duplicates.map((dup) => (
              <div
                key={dup.bookId}
                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-[var(--foreground)]">
                      {dup.title}
                    </p>
                    <p className="text-xs text-[var(--subheading-text)]">
                      by {dup.authors.join(", ")}
                    </p>
                    <p className="text-xs text-[var(--subheading-text)] mt-1">
                      Source: {dup.source} • {dup.similarity.toFixed(0)}% similar
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Title - Required */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => validateField("title")}
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              placeholder="Enter book title"
            />
            {validationErrors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.title}</p>
            )}
          </div>

          {/* Authors - Required */}
          <div>
            <label htmlFor="authors" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
              Authors <span className="text-red-500">*</span>
            </label>
            <input
              id="authors"
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              onBlur={() => validateField("authors")}
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              placeholder="e.g., Jane Doe, John Smith (comma-separated)"
            />
            {validationErrors.authors && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.authors}</p>
            )}
          </div>

          {/* Optional fields in grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* ISBN */}
            <div>
              <label htmlFor="isbn" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
                ISBN
              </label>
              <input
                id="isbn"
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                placeholder="ISBN-10 or ISBN-13"
              />
              {validationErrors.isbn && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.isbn}</p>
              )}
            </div>

            {/* Total Pages */}
            <div>
              <label htmlFor="totalPages" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
                Total Pages
              </label>
              <input
                id="totalPages"
                type="number"
                min="1"
                max="10000"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                placeholder="e.g., 350"
              />
              {validationErrors.totalPages && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.totalPages}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Publisher */}
            <div>
              <label htmlFor="publisher" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
                Publisher
              </label>
              <input
                id="publisher"
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                placeholder="e.g., Penguin Books"
              />
            </div>

            {/* Publication Date */}
            <div>
              <label htmlFor="pubDate" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
                Publication Date
              </label>
              <input
                id="pubDate"
                type="date"
                value={pubDate}
                onChange={(e) => setPubDate(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Series */}
            <div>
              <label htmlFor="series" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
                Series
              </label>
              <input
                id="series"
                type="text"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                placeholder="e.g., Harry Potter"
              />
            </div>

            {/* Series Index */}
            <div>
              <label htmlFor="seriesIndex" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
                Series Number
              </label>
              <input
                id="seriesIndex"
                type="number"
                step="0.1"
                value={seriesIndex}
                onChange={(e) => setSeriesIndex(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
                placeholder="e.g., 1"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
              Tags
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              placeholder="e.g., fiction, fantasy (comma-separated)"
            />
          </div>

          {/* Cover Image Upload */}
          <CoverUploadField
            coverFile={coverFile}
            onCoverFileChange={setCoverFile}
            coverUrl={coverUrl}
            onCoverUrlChange={setCoverUrl}
            coverPreviewUrl={coverPreviewUrl}
            onPreviewUrlChange={setCoverPreviewUrl}
            validationError={validationErrors.cover}
            onValidationError={(error) => {
              setValidationErrors((prev) => {
                const updated = { ...prev };
                if (error) {
                  updated.cover = error;
                } else {
                  delete updated.cover;
                }
                return updated;
              });
            }}
            disabled={isSubmitting}
          />

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              placeholder="Brief description or notes about the book"
            />
          </div>

          {/* Duplicate warning inline */}
          {duplicates.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                ⚠️ Potential duplicate{duplicates.length > 1 ? "s" : ""} found
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                {duplicates.length} similar book{duplicates.length > 1 ? "s" : ""} already in your library
              </p>
            </div>
          )}
        </div>
      );

  // Modal actions
  const modalActions = (
    <>
      <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
        {showDuplicateWarning ? "Go Back" : "Cancel"}
      </Button>
      <Button onClick={handleSubmit} disabled={isSubmitting}>
        {showDuplicateWarning ? "Add Anyway" : "Add Book"}
      </Button>
    </>
  );

  // Render as BottomSheet on mobile, BaseModal on desktop
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        icon={modalIcon}
        size="full"
        allowBackdropClose={!isSubmitting}
        actions={modalActions}
      >
        {modalContent}
      </BottomSheet>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      size="xl"
      loading={isSubmitting}
      actions={modalActions}
      allowBackdropClose={false}
    >
      {modalContent}
    </BaseModal>
  );
}
