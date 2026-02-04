"use client";

import BaseModal from "./BaseModal";
import { Button } from "@/components/Utilities/Button";

interface ArchiveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bookTitle: string;
  pendingStatus: string | null;
}

export default function ArchiveSessionModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  pendingStatus,
}: ArchiveSessionModalProps) {
  const statusText = pendingStatus === "read-next" ? "Read Next" : "Want to Read";

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Archive Reading Session?"
      actions={
        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
          >
            Archive & Change Status
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[var(--foreground)]/70 font-medium">
          You have logged progress for this book. Changing the status will:
        </p>
        <ul className="list-disc list-inside text-[var(--foreground)]/70 ml-3 space-y-1">
          <li>Archive your current reading session with its progress</li>
          <li>Start a fresh session with {statusText} status</li>
          <li>Preserve your reading history (viewable in Reading History)</li>
        </ul>
        <p className="text-[var(--foreground)] font-semibold">
          Continue with status change?
        </p>
      </div>
    </BaseModal>
  );
}
