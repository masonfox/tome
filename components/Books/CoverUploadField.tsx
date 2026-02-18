"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";

/** Max cover file size in bytes (5MB) */
const MAX_COVER_SIZE = 5 * 1024 * 1024;

/** Accepted cover MIME types */
const ACCEPTED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Accept string for file input */
const ACCEPTED_COVER_INPUT = ".jpg,.jpeg,.png,.webp,.gif";

export interface CoverUploadFieldProps {
  // File state
  coverFile: File | null;
  onCoverFileChange: (file: File | null) => void;

  // URL state
  coverUrl: string;
  onCoverUrlChange: (url: string) => void;

  // Preview
  coverPreviewUrl: string | null;
  onPreviewUrlChange: (url: string | null) => void;

  // Validation
  validationError?: string;
  onValidationError?: (error: string | null) => void;

  // Existing cover (for edit mode)
  existingCoverUrl?: string | null;

  // UI customization
  label?: string;
  showExistingCover?: boolean;
  disabled?: boolean;
}

export default function CoverUploadField({
  coverFile,
  onCoverFileChange,
  coverUrl,
  onCoverUrlChange,
  coverPreviewUrl,
  onPreviewUrlChange,
  validationError,
  onValidationError,
  existingCoverUrl,
  label = "Cover Image",
  showExistingCover = false,
  disabled = false,
}: CoverUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  /** Validate and set cover file, creating a preview URL */
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ACCEPTED_COVER_TYPES.includes(file.type)) {
      onValidationError?.(
        `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF`
      );
      return;
    }

    // Validate size
    if (file.size > MAX_COVER_SIZE) {
      onValidationError?.(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 5MB`
      );
      return;
    }

    // Clear any previous cover error
    onValidationError?.(null);

    // Revoke previous preview URL
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }

    onCoverFileChange(file);
    onPreviewUrlChange(URL.createObjectURL(file));
  };

  /** Remove the selected cover file */
  const handleCoverRemove = () => {
    onCoverFileChange(null);
    onCoverUrlChange("");
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
      onPreviewUrlChange(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Clear cover error if any
    onValidationError?.(null);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--subheading-text)] mb-1">
        {label}
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_COVER_INPUT}
        onChange={handleCoverSelect}
        className="hidden"
        id="cover-upload"
        disabled={disabled}
      />
      {coverPreviewUrl ? (
        // Show preview of newly selected file
        <div className="flex items-start gap-3">
          <div className="relative w-20 h-28 rounded overflow-hidden border border-[var(--border-color)] flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverPreviewUrl}
              alt="Cover preview"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-[var(--subheading-text)] truncate max-w-[200px]">
              {coverFile?.name}
            </p>
            <p className="text-xs text-[var(--subheading-text)]/70">
              {coverFile ? `${(coverFile.size / 1024).toFixed(0)} KB` : ""}
            </p>
            <button
              type="button"
              onClick={handleCoverRemove}
              disabled={disabled}
              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          </div>
        </div>
      ) : showExistingCover && existingCoverUrl ? (
        // Show existing cover with option to replace (edit mode)
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="relative w-20 h-28 rounded overflow-hidden border border-[var(--border-color)] flex-shrink-0">
              <Image
                src={existingCoverUrl}
                alt="Current cover"
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[var(--subheading-text)]">
                Current cover
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ImagePlus className="w-3 h-3" />
                Replace cover
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-[var(--border-color)]"></div>
            <span className="text-xs text-[var(--subheading-text)] uppercase">or</span>
            <div className="flex-1 border-t border-[var(--border-color)]"></div>
          </div>

          <div>
            <input
              id="coverUrl"
              type="url"
              value={coverUrl}
              onChange={(e) => onCoverUrlChange(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="https://example.com/cover.jpg"
            />
            <p className="mt-1 text-xs text-[var(--subheading-text)]">
              Enter image URL (if both file and URL provided, file takes priority)
            </p>
          </div>
        </div>
      ) : (
        // No cover selected or existing (create mode / no existing cover)
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 border border-dashed border-[var(--border-color)] rounded-md text-sm text-[var(--subheading-text)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ImagePlus className="w-4 h-4" />
            Choose cover image (JPEG, PNG, WebP, GIF — max 5MB)
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-[var(--border-color)]"></div>
            <span className="text-xs text-[var(--subheading-text)] uppercase">or</span>
            <div className="flex-1 border-t border-[var(--border-color)]"></div>
          </div>

          <div>
            <input
              id="coverUrl"
              type="url"
              value={coverUrl}
              onChange={(e) => onCoverUrlChange(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded-md bg-[var(--background)] text-[var(--foreground)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="https://example.com/cover.jpg"
            />
            <p className="mt-1 text-xs text-[var(--subheading-text)]">
              Enter image URL (if both file and URL provided, file takes priority)
            </p>
          </div>
        </div>
      )}
      {validationError && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationError}</p>
      )}
    </div>
  );
}
